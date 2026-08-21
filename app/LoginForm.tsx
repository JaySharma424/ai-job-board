'use client';

import { useState, useEffect } from 'react';

type LoginFormProps = {
  onLoginSuccess: (email: string) => void;
  onSwitchToRegister: () => void;
  onGuestLogin: () => void;
};

export default function LoginForm({ onLoginSuccess, onSwitchToRegister, onGuestLogin }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'updatePassword'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check URL parameters for password reset link handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    const emailParam = params.get('email');
    if (token && emailParam) {
      setResetToken(token);
      setEmail(emailParam);
      setMode('updatePassword');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'forgot') {
      const res = await fetch('http://localhost:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) setSuccess(data.message);
      else setError(data.error);
      return;
    }

    if (mode === 'updatePassword') {
      const res = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, newPassword: password })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => { 
          setMode('login'); 
          window.history.replaceState({}, document.title, window.location.pathname); 
        }, 2000);
      } else {
        setError(data.error);
      }
      return;
    }

    // Standard Login
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) onLoginSuccess(data.email);
      else setError(data.detail || data.error || 'Authentication failed');
    } catch (err) {
      setError('Network error. Is the backend running?');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-600 tracking-tight">Job Dekho</h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'login' && 'Sign in to your professional portal'}
            {mode === 'forgot' && 'Enter your registered email to reset password'}
            {mode === 'updatePassword' && 'Enter your new secure password'}
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode !== 'updatePassword' && (
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Email ID</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
            </div>
          )}
          {mode !== 'forgot' && (
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{mode === 'updatePassword' ? 'New Password' : 'Password'}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
            </div>
          )}
          <button type="submit" className="mt-2 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">
            {mode === 'login' && 'Login'}
            {mode === 'forgot' && 'Send Reset Mail'}
            {mode === 'updatePassword' && 'Update Password'}
          </button>
        </form>

        <div className="flex justify-between items-center mt-5 text-sm font-semibold">
          {mode === 'login' ? (
            <>
              <button onClick={onSwitchToRegister} className="text-blue-600 hover:underline">Register instead</button>
              <button onClick={() => setMode('forgot')} className="text-slate-400 hover:underline">Forgot Password?</button>
            </>
          ) : (
            <button onClick={() => setMode('login')} className="text-blue-600 hover:underline">Back to Login</button>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <button onClick={onGuestLogin} className="text-slate-500 text-sm font-semibold hover:text-slate-800">
            Continue as Guest &rarr;
          </button>
        </div>
      </div>
    </main>
  );
}