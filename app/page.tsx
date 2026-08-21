'use client';

import { useState, useEffect } from 'react';
import CandidateDashboard from './CandidateDashboard';
import EmployerDashboard from './EmployerDashboard';

export default function Home() {
  const [user, setUser] = useState<{ email: string; isGuest: boolean } | null>(null);
  const [portalMode, setPortalMode] = useState<'candidate' | 'employer'>('candidate');
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [isEmployerRegister, setIsEmployerRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Employer Profile Creation Fields
  const [companyName, setCompanyName] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [industry, setIndustry] = useState('Artificial Intelligence & SaaS');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Bengaluru, Karnataka');

  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  // 🚀 Dynamic API Base URL
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://ai-job-board-backend-izko.onrender.com';

  // Dynamic Typewriter State
  const candidateKeywords = ["software", "product", "design", "data"];
  const employerKeywords = ["engineers", "designers", "managers", "analysts"];
  const [keywordIndex, setKeywordIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setKeywordIndex((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (portalMode === 'candidate' && isLogin) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          setUser({ email, isGuest: false });
        } else {
          setError(data.detail || 'Invalid email or password.');
        }
      } catch (err) {
        setError('Network error connecting to backend.');
      }
      return;
    }

    if (portalMode === 'employer' && !isEmployerRegister) {
      try {
        const res = await fetch(`${API_BASE}/api/employer/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.requires_otp) {
          setShowOtpModal(true);
        } else {
          setError(data.detail || 'Invalid recruiter credentials.');
        }
      } catch (err) {
        setError('Network error connecting to backend.');
      }
      return;
    }

    const endpoint = portalMode === 'employer' 
      ? `${API_BASE}/api/employer/send-otp` 
      : `${API_BASE}/api/auth/send-otp`;

    const bodyPayload = portalMode === 'employer' 
      ? { email, password, company_name: companyName, employer_name: employerName, gst_number: gstNumber, industry, phone, location }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (data.success) {
        setShowOtpModal(true);
      } else {
        setError(data.detail || 'Failed to initiate registration.');
      }
    } catch (err) {
      setError('Network error initiating registration.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setIsVerifying(true);

    const endpoint = portalMode === 'employer' 
      ? `${API_BASE}/api/employer/verify-otp` 
      : `${API_BASE}/api/auth/verify-otp`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });
      const data = await res.json();
      if (data.success) {
        setShowOtpModal(false);
        setUser({ email, isGuest: false });
      } else {
        setOtpError(data.detail || 'Invalid or expired OTP.');
      }
    } catch (err) {
      setOtpError('Network error verifying OTP.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);
    
    const endpoint = portalMode === 'employer' 
      ? `${API_BASE}/api/employer/forgot-password` 
      : `${API_BASE}/api/auth/forgot-password`;
      
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (data.success) { 
        setForgotStep(2); // Move to OTP input screen
      } else { 
        alert(data.detail || "Failed to send instructions."); 
      }
    } catch (err) { 
      alert("Network error."); 
    } finally { 
      setSendingReset(false); 
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);
    
    const endpoint = portalMode === 'employer' 
      ? `${API_BASE}/api/employer/reset-password` 
      : `${API_BASE}/api/auth/reset-password`;
      
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword })
      });
      const data = await res.json();
      if (data.success) { 
        alert(data.message); 
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotEmail('');
        setForgotOtp('');
        setNewPassword('');
      } else { 
        alert(data.detail || "Failed to reset password."); 
      }
    } catch (err) { 
      alert("Network error."); 
    } finally { 
      setSendingReset(false); 
    }
  };

  const handleGuestLogin = () => setUser({ email: 'guest@ainaukri.com', isGuest: true });
  const handleLogout = () => { setUser(null); setPortalMode('candidate'); setEmail(''); setPassword(''); setIsEmployerRegister(false); };

  if (user) {
    if (portalMode === 'employer') return <EmployerDashboard user={user} onSwitchMode={() => setPortalMode('candidate')} onLogout={handleLogout} />;
    return <CandidateDashboard user={user} onSwitchMode={() => setPortalMode('employer')} onLogout={handleLogout} />;
  }

  if (!mounted) return null;

  const candidateFeatures = [
    { icon: "⚡", title: "1-Click Auto Apply", desc: "Our AI generates custom cover letters and applies to top matches instantly." },
    { icon: "🤖", title: "Executive Interview Coach", desc: "Practice mock interviews and STAR method drills tailored to your target role." },
    { icon: "🎯", title: "Vector Skill Matching", desc: "Go beyond keyword search. We match your actual experience to hidden job requirements." }
  ];

  const employerFeatures = [
    { icon: "🔍", title: "Deep Talent Indexing", desc: "Search millions of candidate resumes using advanced semantic vector search." },
    { icon: "📊", title: "Instant ATS Scoring", desc: "See exactly why a candidate matches your job description with 0-100% precision." },
    { icon: "✉️", title: "Automated Prep Kits", desc: "Send auto-generated technical interview kits to candidates before they meet you." }
  ];

  return (
    <div className="min-h-screen bg-[#fafcff] text-slate-800 font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white transition-colors duration-500 flex flex-col">
      
      {/* --- GLOBAL STYLES & ANIMATIONS --- */}
      <style dangerouslySetInnerHTML={{ __html: `
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float 6s ease-in-out 3s infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        .bg-grid-pattern { background-image: linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px); background-size: 32px 32px; }
        .shimmer-btn { position: relative; overflow: hidden; }
        .shimmer-btn::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent); transform: skewX(-20deg); animation: shimmer 3s infinite; }
        @keyframes shimmer { 100% { left: 200%; } }
        .animate-marquee { animation: marquee 25s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
      `}} />

      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0 h-[100vh]"></div>
      <div className={`absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[120px] animate-pulse opacity-40 pointer-events-none transition-colors duration-700 ${portalMode === 'employer' ? 'bg-amber-300' : 'bg-blue-300'}`}></div>
      <div className={`absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full blur-[120px] animate-pulse opacity-40 pointer-events-none transition-colors duration-700 delay-1000 ${portalMode === 'employer' ? 'bg-orange-300' : 'bg-indigo-300'}`}></div>

      {/* --- STICKY HEADER --- */}
      <header className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setPortalMode('candidate'); setIsEmployerRegister(false); setIsLogin(true); }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-lg transition-all duration-500 group-hover:rotate-12 ${portalMode === 'employer' ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/30' : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/30'}`}>
              {portalMode === 'employer' ? 'E' : 'A'}
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 leading-none">Job Dekho</span>
          </div>

          <div className="hidden md:flex bg-slate-100/80 p-1 rounded-full border border-slate-200 shadow-inner relative">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-out shadow-sm ${portalMode === 'employer' ? 'bg-amber-500 left-[calc(50%+2px)]' : 'bg-blue-600 left-1'}`}></div>
            <button 
              onClick={() => { setPortalMode('candidate'); setIsEmployerRegister(false); setIsLogin(true); }}
              className={`relative z-10 text-xs font-bold px-6 py-2 rounded-full transition-colors w-32 ${portalMode === 'candidate' ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              For Candidates
            </button>
            <button 
              onClick={() => { setPortalMode('employer'); setIsLogin(true); }}
              className={`relative z-10 text-xs font-bold px-6 py-2 rounded-full transition-colors w-32 ${portalMode === 'employer' ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              For Employers
            </button>
          </div>

          <div>
             <button 
                onClick={() => {
                  const formElement = document.getElementById("auth-card");
                  formElement?.scrollIntoView({ behavior: "smooth", block: "center" });
                }} 
                className={`text-xs font-bold px-5 py-2.5 rounded-xl text-white shadow-md transition-transform hover:-translate-y-0.5 ${portalMode === 'employer' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                Sign In &rarr;
              </button>
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section className="flex-1 w-full max-w-7xl mx-auto px-6 pt-32 lg:pt-40 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-20">
        
        {/* LEFT COLUMN: HERO COPY & FLOATING WIDGETS */}
        <div className="lg:col-span-7 flex flex-col gap-8 text-left relative">
          
          <div className={`hidden md:flex absolute -left-12 top-10 bg-white/90 backdrop-blur-2xl border border-white/60 p-3.5 rounded-2xl shadow-xl shadow-slate-200/50 items-center gap-3 animate-float z-20 transition-all duration-500 ${portalMode === 'employer' ? 'border-amber-100' : 'border-blue-100'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${portalMode === 'employer' ? 'bg-gradient-to-tr from-amber-100 to-orange-100 text-orange-600' : 'bg-gradient-to-tr from-emerald-100 to-teal-100 text-emerald-600'}`}>
              {portalMode === 'employer' ? '🔥' : '✓'}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{portalMode === 'employer' ? 'New Top Match' : 'ATS Score'}</p>
              <p className="text-sm font-black text-slate-800">{portalMode === 'employer' ? 'Sarah J. - 98% Fit' : '95% Match - Google'}</p>
            </div>
          </div>

          <div className={`hidden md:flex absolute right-10 -bottom-8 bg-white/90 backdrop-blur-2xl border border-white/60 p-3.5 rounded-2xl shadow-xl shadow-slate-200/50 items-center gap-3 animate-float-delayed z-20 transition-all duration-500 ${portalMode === 'employer' ? 'border-orange-100' : 'border-indigo-100'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${portalMode === 'employer' ? 'bg-gradient-to-tr from-orange-100 to-red-100 text-orange-600' : 'bg-gradient-to-tr from-indigo-100 to-violet-100 text-indigo-600'}`}>
              {portalMode === 'employer' ? '⚡' : '✨'}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{portalMode === 'employer' ? 'Vector Search' : 'Interview Hub'}</p>
              <p className="text-sm font-black text-slate-800">{portalMode === 'employer' ? 'Indexed in 1.2s' : 'Prep Kit Ready'}</p>
            </div>
          </div>

          <div className="relative z-10 pl-6 border-l-[6px] rounded-sm transition-colors duration-500 animate-in slide-in-from-bottom-8 fade-in duration-700" style={{ borderColor: portalMode === 'employer' ? '#f59e0b' : '#2563eb' }}>
            <div className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-sm mb-6 border transition-colors duration-500 ${portalMode === 'employer' ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-blue-100 border-blue-200 text-blue-800'}`}>
              {portalMode === 'employer' ? 'Enterprise AI Screening' : 'Next-Gen Matching Engine'}
            </div>
            
            <h1 className="text-5xl sm:text-7xl lg:text-[4.5rem] font-black tracking-tighter leading-[1.05] text-slate-900 mb-6 transition-all">
              {portalMode === 'employer' ? 'Hire top ' : 'Find your dream '}
              <br className="hidden sm:block"/>
              
              <span key={keywordIndex} className={`inline-block animate-in slide-in-from-bottom-2 fade-in duration-500 bg-gradient-to-r bg-clip-text text-transparent pb-2 ${portalMode === 'employer' ? 'from-amber-500 to-orange-500' : 'from-blue-600 to-indigo-600'}`}>
                {portalMode === 'employer' ? employerKeywords[keywordIndex] : candidateKeywords[keywordIndex]}
              </span>
              <br className="hidden sm:block"/>
              {portalMode === 'employer' ? 'smarter & faster.' : 'role with AI.'}
            </h1>
            
            <p className="text-slate-600 text-lg leading-relaxed max-w-lg font-medium mb-8">
              {portalMode === 'employer' 
                ? 'Sign in to access corporate candidate pools, review AI ATS rankings, and manage your hiring pipeline with instant OTP verification.' 
                : 'Match your resume with active verified portal listings, generate customized cover letters instantly, and practice with our executive interview coach.'}
            </p>
          </div>

          {/* Social Proof Marquee */}
          <div className="mt-2 pt-6 border-t border-slate-200/60 overflow-hidden w-full max-w-lg relative animate-in fade-in duration-1000 delay-300">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Trusted by innovative teams at</p>
            <div className="absolute left-0 top-10 bottom-0 w-16 bg-gradient-to-r from-[#fafcff] to-transparent z-10"></div>
            <div className="absolute right-0 top-10 bottom-0 w-16 bg-gradient-to-l from-[#fafcff] to-transparent z-10"></div>
            
            <div className="flex w-[200%] animate-marquee">
              <div className="flex w-1/2 justify-around items-center font-black text-2xl text-slate-300 tracking-tighter grayscale opacity-60">
                <span>Google</span><span>Amazon</span><span>Netflix</span><span>Meta</span><span>Spotify</span>
              </div>
              <div className="flex w-1/2 justify-around items-center font-black text-2xl text-slate-300 tracking-tighter grayscale opacity-60">
                <span>Google</span><span>Amazon</span><span>Netflix</span><span>Meta</span><span>Spotify</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: GLASSMORPHISM AUTH CARD */}
        <div id="auth-card" className="lg:col-span-5 relative z-30 perspective-1000 animate-in slide-in-from-right-8 fade-in duration-700">
          <div className={`absolute inset-0 rounded-[3rem] blur-3xl opacity-60 transition-all duration-700 pointer-events-none ${portalMode === 'employer' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}></div>
          
          <div className="relative bg-white/80 backdrop-blur-2xl border border-white p-8 sm:p-10 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-500 group">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {portalMode === 'employer' ? (isEmployerRegister ? 'Create Recruiter Profile' : 'Recruiter Login') : (isLogin ? 'Welcome Back' : 'Get Started')}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                  {portalMode === 'employer' ? (isEmployerRegister ? 'Verify GST & Employer info' : 'Enter credentials to receive Login OTP') : 'Enter credentials to access workspace'}
                </p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border transition-transform duration-500 group-hover:scale-110 ${portalMode === 'employer' ? 'bg-amber-50 border-amber-100 text-amber-600 shadow-amber-500/10' : 'bg-blue-50 border-blue-100 text-blue-600 shadow-blue-500/10'}`}>
                {portalMode === 'employer' ? '🏢' : '🚀'}
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-4 rounded-2xl font-bold mb-6 flex items-center gap-2 animate-in fade-in"><span>⚠️</span> {error}</div>}

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-5 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              
              {portalMode === 'employer' && isEmployerRegister && (
                <div className="bg-slate-50/80 border border-slate-200 p-5 rounded-3xl flex flex-col gap-4 animate-in slide-in-from-top-4 fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company Name" className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-xs outline-none focus:ring-2 focus:border-amber-500 focus:ring-amber-200 shadow-sm transition-all" />
                    <input type="text" required value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="Recruiter Name" className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-xs outline-none focus:ring-2 focus:border-amber-500 focus:ring-amber-200 shadow-sm transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" required value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="GST Number" className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-xs outline-none focus:ring-2 focus:border-amber-500 focus:ring-amber-200 shadow-sm transition-all font-mono" />
                    <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-xs outline-none focus:ring-2 focus:border-amber-500 focus:ring-amber-200 shadow-sm transition-all" />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{portalMode === 'employer' ? 'Work Email' : 'Email Address'}</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={portalMode === 'employer' ? "recruiter@company.com" : "name@example.com"} className={`w-full bg-white/80 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 transition-all font-semibold shadow-sm ${portalMode === 'employer' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-blue-600 focus:ring-blue-500/20'}`} />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center ml-1 mr-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  {!isEmployerRegister && (
                    <button 
                      type="button" 
                      onClick={() => setShowForgotModal(true)} 
                      className={`text-[10px] font-bold transition-colors ${portalMode === 'employer' ? 'text-amber-600 hover:text-amber-800' : 'text-blue-600 hover:text-blue-800'}`}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`w-full bg-white/80 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 transition-all font-semibold shadow-sm ${portalMode === 'employer' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-blue-600 focus:ring-blue-500/20'}`} />
              </div>

              <button type="submit" className={`shimmer-btn w-full text-white font-black py-4 rounded-2xl text-sm shadow-[0_8px_20px_rgb(0,0,0,0.12)] transition-all transform hover:-translate-y-0.5 active:scale-[0.98] mt-2 ${portalMode === 'employer' ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-orange-500/40' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/40'}`}>
                {portalMode === 'employer' ? (isEmployerRegister ? 'Register & Send OTP 🚀' : 'Send Login OTP 📨') : (isLogin ? 'Sign In to Portal' : 'Create Free Account')}
              </button>
            </form>

            <div className="flex flex-col gap-4 pt-6 border-t border-slate-200/60 mt-6">
              {portalMode === 'candidate' && (
                <button onClick={handleGuestLogin} className="w-full bg-white text-slate-700 font-black py-3.5 rounded-2xl text-xs border border-slate-200 shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors group/btn">
                  <span className="group-hover/btn:animate-bounce">⚡</span> Explore as Guest
                </button>
              )}
              <div className="text-center">
                <button type="button" onClick={() => { if (portalMode === 'employer') { setIsEmployerRegister(!isEmployerRegister); setIsLogin(!isEmployerRegister); } else { setIsLogin(!isLogin); } }} className={`text-xs font-black transition-colors ${portalMode === 'employer' ? 'text-amber-600 hover:underline' : 'text-blue-600 hover:underline'}`}>
                  {portalMode === 'employer' ? (isEmployerRegister ? "Already registered? Sign in" : "New employer? Create company profile") : (isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in")}
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- FEATURES HIGHLIGHT SECTION --- */}
      <section className="bg-white border-y border-slate-200 py-20 relative z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Why Choose Job Dekho?</h2>
            <p className="text-sm text-slate-500 font-medium mt-3">The smartest tools built for modern {portalMode === 'employer' ? 'recruiters' : 'job seekers'}.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(portalMode === 'employer' ? employerFeatures : candidateFeatures).map((feature, i) => (
              <div key={i} className="p-8 rounded-[2rem] border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm border ${portalMode === 'employer' ? 'bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' : 'bg-blue-50 border-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'} transition-colors duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- NAUKRI STYLE FOOTER --- */}
      <footer className="w-full bg-slate-50 relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12 border-b border-slate-200 pb-12">
            {/* Logo and Connect */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <h2 className="text-2xl font-black text-blue-600 tracking-tighter flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg">A</div>
                Job Dekho
              </h2>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-700">Connect with us</span>
                <div className="flex gap-3 text-slate-400">
                  <span className="w-8 h-8 border border-slate-300 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-colors">f</span>
                  <span className="w-8 h-8 border border-slate-300 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer hover:border-pink-600 hover:text-pink-600 hover:bg-pink-50 transition-colors">ig</span>
                  <span className="w-8 h-8 border border-slate-300 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer hover:border-slate-900 hover:text-slate-900 hover:bg-slate-100 transition-colors">X</span>
                  <span className="w-8 h-8 border border-slate-300 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer hover:border-blue-700 hover:text-blue-700 hover:bg-blue-50 transition-colors">in</span>
                </div>
              </div>
            </div>

            {/* Links Column 1 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3.5 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer transition-colors">About us</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Careers</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors font-bold text-slate-800" onClick={() => {setPortalMode('employer'); setIsLogin(true); window.scrollTo({top:0, behavior:'smooth'});}}>Employer home</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Sitemap</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Credits</li>
              </ul>
            </div>

            {/* Links Column 2 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3.5 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Help center</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Summons/Notices</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Grievances</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Report issue</li>
              </ul>
            </div>

            {/* Links Column 3 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3.5 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Privacy policy</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Terms & conditions</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Fraud alert</li>
                <li className="hover:text-blue-600 cursor-pointer transition-colors">Trust & safety</li>
              </ul>
            </div>

            {/* App Promotion */}
            <div className="lg:col-span-1">
              <div className="border border-slate-200 p-5 rounded-2xl bg-white shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>
                <h3 className="font-black text-slate-800 text-sm z-10">Apply on the go</h3>
                <p className="text-[10px] text-slate-500 mb-2 z-10 font-medium">Get real-time job updates directly on our mobile application.</p>
                <div className="flex flex-col gap-2 z-10">
                  <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors">
                    <span className="text-lg leading-none">▶</span>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-wider text-slate-300 leading-none mb-0.5">Get it on</span>
                      <span className="text-xs font-bold leading-none">Google Play</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors">
                    <span className="text-lg leading-none"></span>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-wider text-slate-300 leading-none mb-0.5">Download on the</span>
                      <span className="text-xs font-bold leading-none">App Store</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <span className="text-2xl font-light text-slate-400 tracking-tighter">infoedge</span>
              <div className="md:border-l border-slate-300 md:pl-4 flex flex-col text-[10px] text-slate-400 font-medium">
                <p>All trademarks are the property of their respective owners.</p>
                <p>All rights reserved © 2026 Info Edge (India) Ltd.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-5 text-xs font-bold text-slate-500">
              <span>Our businesses</span>
              <span className="cursor-pointer hover:text-slate-800 transition-colors flex items-center gap-1"><span className="text-emerald-500">✓</span> select</span>
              <span className="text-pink-500 cursor-pointer hover:text-pink-600 transition-colors">minis</span>
              <span className="text-orange-600 cursor-pointer hover:text-orange-700 transition-colors flex items-center gap-1"><span className="bg-orange-600 text-white w-4 h-4 rounded text-[10px] flex items-center justify-center leading-none">c</span> codingninjas</span>
            </div>
          </div>

        </div>
      </footer>

      {/* --- OTP VERIFICATION MODAL --- */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative text-center">
            <button onClick={() => setShowOtpModal(false)} className="absolute top-6 right-8 text-2xl text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
            <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center text-2xl mx-auto mb-6 shadow-inner border ${portalMode === 'employer' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>✉️</div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Verify your email</h3>
            <p className="text-xs text-slate-500 mb-8 font-medium px-2">We sent a secure 6-digit code to <strong>{email}</strong>.</p>
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <input type="text" maxLength={6} required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="000000" className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-2xl tracking-[0.7em] text-center font-mono font-black text-slate-900 outline-none focus:ring-4 transition-all shadow-inner ${portalMode === 'employer' ? 'focus:ring-amber-500/20 focus:border-amber-500' : 'focus:ring-blue-500/20 focus:border-blue-500'}`} />
              {otpError && <p className="text-red-500 text-xs font-bold animate-in fade-in">{otpError}</p>}
              <button type="submit" disabled={isVerifying} className={`shimmer-btn w-full text-white font-black py-4 rounded-2xl text-sm shadow-xl transition-all disabled:opacity-50 mt-2 hover:-translate-y-0.5 ${portalMode === 'employer' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                {isVerifying ? "Verifying..." : "Confirm & Enter Portal ✓"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- FORGOT PASSWORD MODAL WITH OTP VERIFICATION --- */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative text-center">
            <button onClick={() => { setShowForgotModal(false); setForgotStep(1); setForgotEmail(''); setForgotOtp(''); setNewPassword(''); }} className="absolute top-6 right-8 text-2xl text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
            <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center text-2xl mx-auto mb-6 shadow-inner border ${portalMode === 'employer' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>🔐</div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-8 font-medium px-2">
              {forgotStep === 1 ? "Enter your email and we'll send a secure reset OTP." : "Enter the 6-digit OTP and your new password."}
            </p>
            
            {forgotStep === 1 ? (
              <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Email</label>
                  <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="name@example.com" className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 transition-all font-semibold ${portalMode === 'employer' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-blue-600 focus:ring-blue-500/20'}`} />
                </div>
                <button type="submit" disabled={sendingReset} className={`shimmer-btn w-full text-white font-black py-4 rounded-2xl text-sm shadow-xl transition-all disabled:opacity-50 mt-4 hover:-translate-y-0.5 ${portalMode === 'employer' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                  {sendingReset ? "Sending OTP..." : "Send Reset OTP 📨"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">6-Digit OTP</label>
                  <input type="text" maxLength={6} required value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value)} placeholder="000000" className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 transition-all font-semibold tracking-[0.5em] text-center ${portalMode === 'employer' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-blue-600 focus:ring-blue-500/20'}`} />
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={`w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 transition-all font-semibold ${portalMode === 'employer' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-blue-600 focus:ring-blue-500/20'}`} />
                </div>
                <button type="submit" disabled={sendingReset} className={`shimmer-btn w-full text-white font-black py-4 rounded-2xl text-sm shadow-xl transition-all disabled:opacity-50 mt-4 hover:-translate-y-0.5 ${portalMode === 'employer' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                  {sendingReset ? "Updating Password..." : "Update Password 🔐"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}