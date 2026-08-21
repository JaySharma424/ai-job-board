'use client';

import { useState } from 'react';

type EmployerAuthProps = {
  onLoginSuccess: (email: string) => void;
  onSwitchToCandidateLogin: () => void;
};

export default function EmployerAuth({ onLoginSuccess, onSwitchToCandidateLogin }: EmployerAuthProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const endpoint = isRegistering ? 'http://localhost:8000/api/auth/register' : 'http://localhost:8000/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          role: 'employer' // Force role to employer
        })
      });
      const data = await res.json();

      if (data.success) {
        if (isRegistering) {
          setSuccess('Employer account created! Please sign in.');
          setIsRegistering(false);
        } else {
          if (data.role !== 'employer') {
            setError('This account is registered as a Candidate, not an Employer.');
            return;
          }
          onLoginSuccess(data.email);
        }
      } else {
        setError(data.detail || data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-800">
        <div className="text-center mb-8">
          <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Employer Portal</span>
          <h1 className="text-3xl font-black text-white tracking-tight mt-3">Job Dekho Recruiter</h1>
          <p className="text-slate-400 text-sm mt-1">{isRegistering ? 'Create your company hiring account' : 'Sign in to post jobs & manage candidates'}</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 font-medium">{error}</div>}
        {success && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm mb-4 font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Work Email ID</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg outline-none focus:border-emerald-400 text-sm text-white" placeholder="recruiter@company.com" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg outline-none focus:border-emerald-400 text-sm text-white" placeholder="••••••••" />
          </div>
          <button type="submit" className="mt-2 bg-emerald-500 text-slate-950 p-3.5 rounded-xl font-black hover:bg-emerald-400 transition-all text-sm shadow-lg">
            {isRegistering ? 'Register Company Account' : 'Employer Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 font-semibold hover:underline">
            {isRegistering ? 'Already have an employer account? Login' : "Don't have a company account? Register"}
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <button onClick={onSwitchToCandidateLogin} className="text-slate-400 text-xs font-semibold hover:text-white">
            &larr; Return to Candidate Login
          </button>
        </div>
      </div>
    </main>
  );
}