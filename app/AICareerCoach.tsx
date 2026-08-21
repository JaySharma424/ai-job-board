"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Job = Record<string, any>;

type MessageRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  error?: boolean;
  retryMessage?: string;
  feedback?: "up" | "down";
};

type Props = {
  extractedResumeText?: string;
  jobs?: Job[];
  isGuest?: boolean;
  isPremium?: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const API_KEY_STORAGE = "ai-career-coach-gemini-key";

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createWelcome = (): ChatMessage => ({
  id: makeId(),
  role: "assistant",
  text:
    "Hi! I’m your AI Career Coach. I can use your resume and active portal jobs to help with matching, resume feedback, and interview preparation.",
  createdAt: Date.now(),
});

function renderText(text: string) {
  const lines = text.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    const isBullet = /^[-*•]\s+/.test(trimmed);
    const isNumbered = /^\d+[.)]\s+/.test(trimmed);
    const clean = isBullet || isNumbered ? trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "") : trimmed;

    const parts = clean.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    const content = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });

    if (isBullet) {
      return (
        <div key={index} className="flex gap-2">
          <span>•</span>
          <span>{content}</span>
        </div>
      );
    }

    return (
      <div key={index} className={isNumbered ? "pl-1" : ""}>
        {content}
      </div>
    );
  });
}

export default function AICareerCoach({
  extractedResumeText = "",
  jobs = [],
  isGuest = false,
  isPremium = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dynamicPrompts, setDynamicPrompts] = useState<string[]>([
    "🎯 Find matching jobs",
    "📝 Review my resume",
    "💡 What skills should I learn?",
  ]);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  // Detailed Feedback State
  const [feedbackUI, setFeedbackUI] = useState<{ msgId: string, type: 'up' | 'down', submitted: boolean } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");

  const sessionIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasResume = Boolean(extractedResumeText?.trim());
  const jobCount = jobs?.length ?? 0;

  const currentHistory = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({
          role: m.role === "assistant" ? ("bot" as const) : ("user" as const),
          text: m.text,
          feedback: m.feedback,
        })),
    [messages]
  );

  useEffect(() => {
    sessionIdRef.current = `session_${makeId()}`; 
    try {
      if (isGuest) {
        setApiKey("");
        localStorage.removeItem(API_KEY_STORAGE);
      } else {
        const savedKey = localStorage.getItem(API_KEY_STORAGE);
        if (savedKey) {
          setApiKey(savedKey);
        }
      }
    } catch {}
    
    setMessages([createWelcome()]);
  }, [isGuest]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [messages, isOpen, isSending, feedbackUI]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const saveApiKey = (value: string) => {
    setApiKey(value);
    if (!isGuest) {
      try {
        if (value.trim()) localStorage.setItem(API_KEY_STORAGE, value.trim());
        else localStorage.removeItem(API_KEY_STORAGE);
      } catch {}
    }
  };

  const clearConversation = () => {
    abortRef.current?.abort();
    setIsSending(false);
    setErrorBanner("");
    setFeedbackUI(null);
    sessionIdRef.current = `session_${makeId()}`; 
    setMessages([createWelcome()]);
    setDynamicPrompts([
      "🎯 Find matching jobs",
      "📝 Review my resume",
      "💡 What skills should I learn?",
    ]);
  };

  // 1. Core API call for both initial likes/dislikes and detailed text feedback
  const sendFeedbackToBackend = async (messageId: string, type: "up" | "down", feedbackText: string = "") => {
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const assistantMsg = messages[msgIndex];
    const userMsg = messages[msgIndex - 1];

    if (!userMsg || assistantMsg.role !== "assistant") return;

    try {
      await fetch(`${API_BASE_URL}/api/chat/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey.trim() ? { "x-gemini-api-key": apiKey.trim() } : {}),
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          message_id: messageId,
          user_message: userMsg.text,
          assistant_response: assistantMsg.text,
          feedback: type,
          feedback_text: feedbackText,
        }),
      });
    } catch (err) {
      console.error("Failed to send feedback to backend:", err);
    }
  };

  // 2. Initial Click Handler (Thumbs Up/Down)
  const handleFeedbackClick = async (messageId: string, type: "up" | "down") => {
    setMessages((prev) => prev.map((msg) => msg.id === messageId ? { ...msg, feedback: type } : msg));
    setFeedbackUI({ msgId: messageId, type, submitted: false });
    setFeedbackComment("");
    // Send immediate basic feedback so backend records the sentiment
    await sendFeedbackToBackend(messageId, type, "");
  };

  // 3. Detailed Text Submission Handler
  const submitDetailedFeedback = async (messageId: string) => {
    if (!feedbackUI) return;
    setFeedbackUI(prev => prev ? { ...prev, submitted: true } : null);
    // Send updated feedback with explicit user instructions
    await sendFeedbackToBackend(messageId, feedbackUI.type, feedbackComment);
  };

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message || isSending) return;

      setErrorBanner("");
      setFeedbackUI(null);

      if (isGuest && !apiKey.trim()) {
        setShowSettings(true);
        setErrorBanner(
          "Guests must provide their own Gemini API key to use the AI Coach."
        );
        return;
      }

      const userMessage: ChatMessage = {
        id: makeId(),
        role: "user",
        text: message,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const timeout = window.setTimeout(() => controller.abort(), 45_000);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey.trim() ? { "x-gemini-api-key": apiKey.trim() } : {}),
          },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            message,
            resumeText: extractedResumeText,
            jobContext: jobs.slice(0, 10),
            history: currentHistory,
            is_premium: isPremium,
          }),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await response.json()
          : { detail: await response.text() };

        if (!response.ok || !data?.success) {
          const detail = data?.detail || data?.error || "AI service error.";
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: "assistant",
              text: detail,
              createdAt: Date.now(),
              error: true,
              retryMessage: message,
            },
          ]);
          setErrorBanner("The AI service could not complete that request.");
          return;
        }

        const assistantText = typeof data.response === "string" ? data.response.trim() : "Empty response.";
        
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setDynamicPrompts(data.suggestions);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            text: assistantText,
            createdAt: Date.now(),
          },
        ]);
      } catch (error: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            text: "I couldn't connect to the AI service. Please check your backend and try again.",
            createdAt: Date.now(),
            error: true,
            retryMessage: message,
          },
        ]);
      } finally {
        window.clearTimeout(timeout);
        setIsSending(false);
      }
    },
    [apiKey, currentHistory, extractedResumeText, isGuest, isSending, jobs, isPremium]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const exportChat = () => {
    const transcript = messages
      .map((m) => {
        const speaker = m.role === "user" ? "You" : "AI Career Coach";
        const timestamp = new Date(m.createdAt).toLocaleString();
        return `[${timestamp}] ${speaker}\n${m.text}`;
      })
      .join("\n\n");

    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `career-coach-chat-${new Date()
      .toISOString()
      .slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const contextLabel = hasResume
    ? `Resume connected${jobCount ? ` • ${jobCount} jobs` : ""}`
    : jobCount
      ? `${jobCount} jobs in context`
      : "General career mode";

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Career Coach"
          className="fixed bottom-6 right-6 z-[120] flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-sm font-black text-white shadow-2xl shadow-blue-500/30 transition hover:scale-105 active:scale-95"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs">
            ✨
          </span>
          AI Career Coach {isPremium && "👑"}
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[120] pointer-events-none">
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]" />

          <section
            aria-label="AI Career Coach"
            className="pointer-events-auto absolute bottom-6 right-6 flex h-[min(680px,calc(100vh-48px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 animate-in fade-in zoom-in duration-200"
          >
            <header className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-xl" />

              <div className="relative flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg shadow-inner">
                    🤖
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black tracking-tight">
                        {isPremium ? "Executive Interview Coach 👑" : "AI Career Coach"}
                      </h2>
                      <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-100">
                        ONLINE
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-blue-100 font-medium">
                      {isPremium ? "Production Mock & STAR Drills" : "Resume-aware adaptive guidance"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Export chat"
                    onClick={exportChat}
                    className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white text-xs font-bold"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    title="Coach settings"
                    onClick={() => setShowSettings((v) => !v)}
                    className={`rounded-xl p-2 transition text-xs font-bold ${
                      showSettings
                        ? "bg-white/20 text-white"
                        : "text-white/80 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    ⚙
                  </button>
                  <button
                    type="button"
                    title="Close"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl p-2 text-lg leading-none text-white/80 transition hover:bg-white/15 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="relative mt-3 flex items-center gap-2 text-[10px]">
                <span className="rounded-xl border border-white/20 bg-white/15 px-2.5 py-1 font-semibold">
                  🧠 {contextLabel}
                </span>
                {hasResume && (
                  <span className="rounded-xl border border-emerald-300/30 bg-emerald-400/20 px-2.5 py-1 text-emerald-100 font-semibold">
                    ✓ Resume Active
                  </span>
                )}
              </div>
            </header>

            {showSettings && (
              <div className="border-b border-slate-200 bg-slate-50 p-4 animate-in slide-in-from-top-2">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-800">
                      Gemini API Key
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {isGuest 
                        ? "Required for guests. Will reset after logout." 
                        : "Optional override. Leave blank to use system default."}
                    </p>
                  </div>
                  {apiKey && (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">
                      {isGuest ? "ENTERED" : "SAVED"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    placeholder="Paste Gemini API key"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => saveApiKey("")}
                    className="rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {errorBanner && (
              <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[10px] font-semibold text-amber-800">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner("")}
                  className="shrink-0 rounded px-1.5 py-0.5 hover:bg-amber-100"
                >
                  ×
                </button>
              </div>
            )}

            <div
              className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 px-4 py-4"
              role="log"
              aria-live="polite"
            >
              <div className="flex flex-col gap-3">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const showDetailedFeedbackInput = feedbackUI?.msgId === message.id && !feedbackUI.submitted;

                  return (
                    <div
                      key={message.id}
                      className={`group flex flex-col ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] ${
                          isUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                            isUser
                              ? "rounded-br-sm bg-blue-600 text-white font-medium"
                              : message.error
                                ? "rounded-bl-sm border border-red-200 bg-red-50 text-red-700 font-medium"
                                : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 font-medium"
                          }`}
                        >
                          {renderText(message.text)}
                        </div>

                        <div
                          className={`mt-1.5 flex items-center gap-2 px-1 text-[9px] text-slate-400 ${
                            isUser ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>

                          {!isUser && !message.error && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <button
                                type="button"
                                onClick={() => handleFeedbackClick(message.id, "up")}
                                title="Helpful response"
                                className={`transition hover:scale-110 ${
                                  message.feedback === "up" ? "text-emerald-600 font-bold scale-110" : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                👍
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFeedbackClick(message.id, "down")}
                                title="Unhelpful response"
                                className={`transition hover:scale-110 ${
                                  message.feedback === "down" ? "text-red-600 font-bold scale-110" : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                👎
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* --- RICH FEEDBACK TEXT CAPTURE UI --- */}
                      {showDetailedFeedbackInput && !isUser && (
                        <div className="mt-2 ml-1 p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl w-full max-w-[85%] animate-in slide-in-from-top-2 fade-in">
                          <p className="text-[10px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                            Help improve future answers
                          </p>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={feedbackComment}
                              onChange={(e) => setFeedbackComment(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && submitDetailedFeedback(message.id)}
                              placeholder={feedbackUI.type === 'up' ? "What did you like? (e.g. Good detail)" : "What should I change? (e.g. Shorter answers)"}
                              className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                              autoFocus
                            />
                            <button 
                              onClick={() => submitDetailedFeedback(message.id)}
                              className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-800 transition-colors shadow-sm"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      )}
                      {feedbackUI?.msgId === message.id && feedbackUI.submitted && (
                        <span className="text-[9px] font-bold text-emerald-600 ml-2 mt-1 animate-in fade-in">✓ Feedback saved for future responses</span>
                      )}
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
                        <span className="ml-1 text-[10px] font-bold text-slate-400">
                          Thinking…
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {!isSending && (
              <div className="border-t border-slate-100 bg-white px-3 py-2.5">
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {dynamicPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="shrink-0 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100 active:scale-95"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50/80 p-1.5 transition focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                  rows={1}
                  maxLength={2000}
                  placeholder={
                    isPremium
                      ? "Practice interview questions, STAR answers..."
                      : hasResume
                      ? "Ask about your resume, jobs, or career…"
                      : "Ask your career coach…"
                  }
                  className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50 font-medium"
                />

                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  ↑
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1 text-[9px] text-slate-400 font-medium">
                <span>Enter to send • Shift+Enter for a new line</span>
                <span>{input.length}/2000</span>
              </div>
            </form>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2">
              <span className="text-[9px] text-slate-400 font-medium">
                {isPremium ? "👑 Executive Mode Active" : "Adaptive AI responses driven by feedback."}
              </span>
              <button
                type="button"
                onClick={clearConversation}
                className="text-[9px] font-bold text-slate-500 hover:text-red-600 transition-colors"
              >
                Clear chat
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}