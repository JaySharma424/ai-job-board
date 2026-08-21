import os
import re
from typing import Optional, List, Dict, Any

import google.generativeai as genai

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from models import ChatResponse, FeedbackRequest, FeedbackResponse, CoachMemoryResponse

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"],
)

# Corrected Default Chat Model
GEMINI_MODEL = os.getenv(
    "GEMINI_CHAT_MODEL",
    "gemini-3.5-flash",
)

MAX_HISTORY_MESSAGES = 12
MAX_RESUME_CHARS = 5000
MAX_JOBS_IN_CONTEXT = 10
MAX_LEARNED_PROMPT_CHARS = 4000

class ChatRequest(BaseModel):
    session_id: Optional[str] = Field(default="default_session", min_length=2, max_length=128)
    message: str = Field(min_length=1, max_length=2000)
    resumeText: str = Field(default="", max_length=20000)
    jobContext: List[Dict[str, Any]] = Field(default_factory=list)
    history: List[Any] = Field(default_factory=list)
    is_premium: Optional[bool] = False

_memory_store: Dict[str, str] = {}
_feedback_store: List[Dict[str, Any]] = []

async def get_coach_memory(session_id: str, user_id: Optional[str] = None) -> str:
    return _memory_store.get(session_id, "")

async def save_coach_memory(session_id: str, learned_prompt: str, user_id: Optional[str] = None) -> None:
    learned_prompt = learned_prompt.strip()
    if len(learned_prompt) > MAX_LEARNED_PROMPT_CHARS:
        learned_prompt = learned_prompt[:MAX_LEARNED_PROMPT_CHARS]
    _memory_store[session_id] = learned_prompt

async def save_feedback_event(data: FeedbackRequest) -> None:
    _feedback_store.append({
        "session_id": data.session_id,
        "user_id": data.user_id,
        "message_id": data.message_id,
        "user_message": data.user_message,
        "assistant_response": data.assistant_response,
        "feedback": data.feedback,
        "feedback_text": data.feedback_text,
    })

def refine_learned_prompt(existing_prompt: str, user_message: str, assistant_response: str, feedback: Optional[str] = None, feedback_text: Optional[str] = None) -> str:
    rules: List[str] = []
    if existing_prompt:
        for line in existing_prompt.splitlines():
            line = line.strip()
            if line:
                rules.append(line.lstrip("-").strip())

    user_text = user_message.lower()
    assistant_text = assistant_response.lower()

    if feedback == "up":
        rules.append("Preserve the response style and usefulness that the user positively rated.")
    elif feedback == "down":
        rules.append("Improve on negatively rated responses and avoid repeating their weaknesses.")

    if feedback_text:
        cleaned_feedback = feedback_text.strip()
        if cleaned_feedback:
            rules.append(f"User improvement preference: {cleaned_feedback[:500]}")

    if any(phrase in user_text for phrase in ["short", "brief", "concise", "in short"]):
        rules.append("Prefer concise answers when the user asks for brevity.")
    if any(phrase in user_text for phrase in ["detailed", "explain", "step by step", "deep", "elaborate"]):
        rules.append("Provide structured detailed explanations when the user explicitly requests depth.")
    if any(phrase in user_text for phrase in ["resume", "cv", "ats"]):
        rules.append("For resume questions, give concrete ATS-friendly edits rather than generic advice.")
    if "interview" in user_text:
        rules.append("For interview preparation, provide realistic questions and actionable evaluation.")

    unique_rules = []
    seen = set()
    for rule in rules:
        normalized = rule.lower().strip()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_rules.append(rule)

    unique_rules = unique_rules[-18:]
    return "\n".join(f"- {rule}" for rule in unique_rules)[:MAX_LEARNED_PROMPT_CHARS]

def generate_dynamic_suggestions(user_message: str, assistant_response: str, is_premium: bool = False) -> List[str]:
    text = (f"{user_message} {assistant_response}").lower()

    if is_premium:
        if any(word in text for word in ["interview", "question", "star", "behavioral", "technical", "drill"]):
            return [
                "🎙️ Give me a follow-up mock question",
                "⭐ Critique my STAR framework breakdown",
                "🏗️ Test System Design edge cases",
            ]
        return [
            "🎤 Start a Mock Interview Drill",
            "📊 Evaluate My Last Answer's Metrics",
            "🎯 Tailor Answer to Target Company",
        ]

    if any(word in text for word in ["skill", "python", "sql", "machine learning"]):
        return [
            "🗓️ Build a 30-day learning plan",
            "🎯 Find jobs for these skills",
            "📄 Add these skills to my resume",
        ]

    return [
        "🔎 Go deeper",
        "🎯 Turn this into a plan",
        "📌 What should I do first?",
    ]

def clean_response(text: str) -> str:
    if not text:
        return "I couldn't generate a response right now. Please try again."

    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json|text|markdown)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    return text.strip()

def build_system_prompt(learned_prompt: str, resume_text: str, jobs: List[Dict[str, Any]], user_message: str, is_premium: bool = False) -> str:
    if is_premium:
        adaptive_profile = f"""
[EXECUTIVE INTERVIEW COACH & TECHNICAL INSTRUCTOR MODE - ACTIVE 👑]
You are an elite, production-grade Executive Technical Instructor and Hiring Manager coach. 
Your standard is uncompromising, rigorous, and directly tailored to top-tier tech and enterprise markets.

Strict Guidelines for Premium Users:
1. **Active Mock Interviews**: When the user asks for practice or a mock interview, adopt the persona of a strict hiring manager. Ask **one challenging question at a time**. Wait for their answer before evaluating.
2. **Strict STAR Method Enforcement**: For behavioral answers, evaluate them using the STAR framework (Situation, Task, Action, Result). Scrutinize the "Action" section—require personal ownership, quantifiable metrics, and first-person active verbs ("I architected", not "We built").
3. **System Design & Technical Probing**: For engineering/technical questions, push the candidate on scalability bottlenecks, trade-offs (e.g., consistency vs. availability), cost implications, and failure recovery.
4. **Zero Fluff**: Eliminate generic advice ("Be confident", "Dress well"). Instead, provide tactical delivery fixes ("Move your impact metric to the first sentence", "Cut the background story by 50%").
"""
    else:
        adaptive_profile = (
            learned_prompt
            if learned_prompt
            else
            """
- Start from the user's actual question.
- Be practical and personalized.
- Avoid generic career advice.
- Give concrete next steps.
- Do not invent information.
            """.strip()
        )

    resume_context = (
        resume_text[:MAX_RESUME_CHARS]
        if resume_text
        else "No resume uploaded yet."
    )

    jobs_context = (
        str(jobs[:MAX_JOBS_IN_CONTEXT])
        if jobs
        else "No specific jobs are currently loaded."
    )

    return f"""
You are the AI Career Coach for an AI-powered job portal.

Your job is to provide practical career guidance based on:
1. The user's current question.
2. Their resume when available.
3. The available job listings when relevant.
4. The conversation history.
5. The adaptive coaching profile learned from previous interactions.

==================================================
ADAPTIVE COACHING PROFILE & GUIDELINES
==================================================

{adaptive_profile}

==================================================
CANDIDATE RESUME
==================================================

{resume_context}

==================================================
AVAILABLE JOBS
==================================================

{jobs_context}

==================================================
CURRENT USER QUESTION
==================================================

{user_message}
""".strip()

@router.post("", response_model=ChatResponse)
async def chat_with_ai(data: ChatRequest, x_gemini_api_key: Optional[str] = Header(default=None)):
    try:
        api_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="Gemini API Key is required.")

        genai.configure(api_key=api_key)
        learned_prompt = await get_coach_memory(session_id=data.session_id)

        gemini_history = []
        for message in data.history[-MAX_HISTORY_MESSAGES:]:
            if isinstance(message, dict):
                msg_text = message.get("text", "")
                msg_role = message.get("role", "user")
            else:
                msg_text = getattr(message, "text", "")
                msg_role = getattr(message, "role", "user")

            if not msg_text.strip():
                continue

            role = "user" if msg_role in ["user", "User"] else "model"

            if not gemini_history and role == "model":
                continue

            if gemini_history and gemini_history[-1]["role"] == role:
                gemini_history[-1]["parts"][0] += f"\n\n{msg_text}"
            else:
                gemini_history.append({"role": role, "parts": [msg_text]})

        prompt = build_system_prompt(learned_prompt=learned_prompt, resume_text=data.resumeText, jobs=data.jobContext, user_message=data.message, is_premium=data.is_premium)

        model = genai.GenerativeModel(model_name=GEMINI_MODEL)
        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(prompt)

        response_text = clean_response(getattr(response, "text", ""))

        refined_prompt = refine_learned_prompt(existing_prompt=learned_prompt, user_message=data.message, assistant_response=response_text)
        await save_coach_memory(session_id=data.session_id, learned_prompt=refined_prompt)

        suggestions = generate_dynamic_suggestions(user_message=data.message, assistant_response=response_text, is_premium=data.is_premium)

        return ChatResponse(success=True, response=response_text, suggestions=suggestions, memoryUpdated=True)

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[CHAT ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail="The AI Career Coach could not complete your request.")

@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(data: FeedbackRequest):
    try:
        await save_feedback_event(data)
        current_prompt = await get_coach_memory(session_id=data.session_id, user_id=data.user_id)
        refined_prompt = refine_learned_prompt(existing_prompt=current_prompt, user_message=data.user_message, assistant_response=data.assistant_response, feedback=data.feedback, feedback_text=data.feedback_text)
        await save_coach_memory(session_id=data.session_id, learned_prompt=refined_prompt, user_id=data.user_id)
        return FeedbackResponse(success=True, message="Feedback saved successfully. Future responses will use this preference.", memoryUpdated=True)
    except Exception as exc:
        print(f"[FEEDBACK ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail="Unable to save chatbot feedback.")

@router.get("/memory/{session_id}", response_model=CoachMemoryResponse)
async def get_memory(session_id: str):
    try:
        learned_prompt = await get_coach_memory(session_id=session_id)
        return CoachMemoryResponse(success=True, session_id=session_id, learned_prompt=learned_prompt)
    except Exception as exc:
        print(f"[MEMORY ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail="Unable to retrieve coach memory.")