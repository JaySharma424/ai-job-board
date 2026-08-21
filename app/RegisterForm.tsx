'use client';

import { useState } from 'react';

type LoginFormProps = {
  onLoginSuccess: (email: string) => void;
  onSwitchToRegister: () => void;
  onGuestLogin: () => void;
};

export default function LoginForm({ onLoginSuccess, onSwitchToRegister, onGuestLogin }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'updatePassword'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dynamic API Base URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8000' 
      : 'https://ai-job-board-backend-izko.onrender.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Step 1: Send OTP to email
    if (mode === 'forgot') {
      try {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          setSuccess(data.message);
          setMode('updatePassword'); // Instantly switch UI to OTP input screen
        } else {
          setError(data.error || data.detail);
        }
      } catch (err) {
        setError('Network error connecting to backend.');
      }
      return;
    }

    // Step 2: Verify OTP and Save New Password
    if (mode === 'updatePassword') {
      try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: otpCode, newPassword: password })
        });
        const data = await res.json();
        if (data.success) {
          setSuccess(data.message);
          setTimeout(() => { 
            setMode('login'); 
            setPassword('');
            setOtpCode('');
            setSuccess('');
          }, 2000);
        } else {
          setError(data.error || data.detail);
        }
      } catch (err) {
        setError('Network error connecting to backend.');
      }
      return;
    }

    // Standard Login
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) onLoginSuccess(data.email);
      else setError(data.detail || data.error || 'Authentication failed');
    } catch (err) {
      setError('Network error connecting to backend.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-600 tracking-tight">Job Dekho</h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'login' && 'Sign in to your professional portal'}
            {mode === 'forgot' && 'Enter your registered email to receive an OTP'}
            {mode === 'updatePassword' && 'Enter your OTP code and a new password'}
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Always hide email input in updatePassword mode so they don't change it */}
          {mode !== 'updatePassword' && (
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Email ID</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
            </div>
          )}

          {/* OTP & New Password Fields */}
          {mode === 'updatePassword' && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">6-Digit Verification Code</label>
                <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} maxLength={6} required placeholder="000000" className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm tracking-[0.5em] text-center font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
              </div>
            </>
          )}

          {/* Login Password Field */}
          {mode === 'login' && (
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
            </div>
          )}

          <button type="submit" className="mt-2 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">
            {mode === 'login' && 'Login'}
            {mode === 'forgot' && 'Send Reset OTP'}
            {mode === 'updatePassword' && 'Verify OTP & Update Password'}
          </button>
        </form>

        <div className="flex justify-between items-center mt-5 text-sm font-semibold">
          {mode === 'login' ? (
            <>
              <button onClick={onSwitchToRegister} className="text-blue-600 hover:underline">Register instead</button>
              <button type="button" onClick={() => setMode('forgot')} className="text-slate-400 hover:underline">Forgot Password?</button>
            </>
          ) : (
            <button type="button" onClick={() => {setMode('login'); setError(''); setSuccess('');}} className="text-blue-600 hover:underline">Back to Login</button>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <button type="button" onClick={onGuestLogin} className="text-slate-500 text-sm font-semibold hover:text-slate-800">
            Continue as Guest &rarr;
          </button>
        </div>
      </div>
    </main>
  );
}