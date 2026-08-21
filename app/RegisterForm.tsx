'use client';

import { useState } from 'react';

type RegisterFormProps = {
  onSwitchToLogin: () => void;
  onGuestLogin: () => void;
};

export default function RegisterForm({ onSwitchToLogin, onGuestLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        setSuccess('Registration successful! Please sign in.');
        setTimeout(() => onSwitchToLogin(), 2000);
      } else {
        setError(data.detail || data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl w-full max-w-md p-8 shadow-lg border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-600 tracking-tight">Job Dekho</h1>
          <p className="text-slate-500 text-sm mt-1">Create your professional account</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4 font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Email ID</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" />
          </div>
          <button type="submit" className="mt-2 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">
            Register Account
          </button>
        </form>

        <div className="mt-5 text-center text-sm font-semibold">
          <button onClick={onSwitchToLogin} className="text-blue-600 hover:underline">Already have an account? Login</button>
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