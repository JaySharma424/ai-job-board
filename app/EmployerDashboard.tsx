'use client';

import { useState, useEffect } from 'react';

type Props = {
  user: { email: string; isGuest: boolean };
  onSwitchMode: () => void;
  onLogout: () => void;
};

// Dynamic API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://ai-job-board-backend-izko.onrender.com');

export default function EmployerDashboard({ user, onSwitchMode, onLogout }: Props) {
  const [currentTab, setCurrentTab] = useState<'overview' | 'post-job' | 'applicants' | 'listings' | 'profile'>('overview');
  
  const [jobsPosted, setJobsPosted] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // REAL-TIME METRICS STATE
  const [metrics, setMetrics] = useState({
    active_postings: 0,
    total_applications: 0,
    shortlisted: 0,
    company_gst: 'Loading...'
  });

  // Recruiter Profile State
  const [profileData, setProfileData] = useState({
    company_name: 'Acme Tech Corp',
    employer_name: 'Hiring Manager',
    gst_number: '29AAAAA0000A1Z5',
    industry: 'Artificial Intelligence & SaaS',
    website: 'https://example.com',
    phone: '+91 9876543210',
    location: 'Bengaluru, Karnataka'
  });

  // Job Posting Form State
  const [newJob, setNewJob] = useState({
    title: '',
    company_name: 'Acme Tech Corp',
    location: 'Bengaluru, Karnataka',
    minExperienceRequired: 'Fresher',
    description: '',
    skills: ''
  });
  const [posting, setPosting] = useState(false);

  const fetchAnalytics = () => {
    fetch(`${API_BASE}/api/employer/analytics?email=${user.email}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMetrics(data.metrics);
        }
      });
  };

  const fetchActiveJobs = () => {
    fetch(`${API_BASE}/api/jobs?source=All&page=1`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJobsPosted(data.data.slice(0, 5));
        }
      });
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/employer/profile?email=${user.email}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setProfileData(data.data);
          setNewJob(prev => ({ ...prev, company_name: data.data.company_name, location: data.data.location }));
        }
      });

    fetchAnalytics();
    fetchActiveJobs();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/employer/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...profileData })
      });
      if ((await res.json()).success) {
        alert("🏢 Company profile and GST details updated successfully!");
        fetchAnalytics(); 
      }
    } catch (err) {
      alert("Failed to update profile.");
    }
  };

  const handlePostJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title || !newJob.description) return alert("Please fill in all required fields.");
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/employer/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newJob,
          email: user.email,
          ai_tags: { skills: newJob.skills.split(',').map(s => s.trim()) }
        })
      });
      const data = await res.json();
      if (data.success || res.ok) {
        alert("🎉 Job successfully published and saved to database!");
        setNewJob({ title: '', company_name: profileData.company_name, location: profileData.location, minExperienceRequired: 'Fresher', description: '', skills: '' });
        fetchAnalytics(); 
        fetchActiveJobs();
        setCurrentTab('overview');
      } else {
        alert("Failed to post job.");
      }
    } catch (err) {
      alert("Network error posting job.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800 pb-32">
      <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-xl text-xs uppercase">Recruiter Studio</span>
              <h1 className="text-xl font-black tracking-tight text-white">Job Dekho</h1>
            </div>
            <div className="hidden md:flex gap-6">
              <button onClick={() => setCurrentTab('overview')} className={`text-xs font-bold transition-all pb-1 border-b-2 ${currentTab === 'overview' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-300 hover:text-white'}`}>Overview</button>
              <button onClick={() => setCurrentTab('post-job')} className={`text-xs font-bold transition-all pb-1 border-b-2 ${currentTab === 'post-job' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-300 hover:text-white'}`}>+ Post New Job</button>
              <button onClick={() => setCurrentTab('listings')} className={`text-xs font-bold transition-all pb-1 border-b-2 ${currentTab === 'listings' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-300 hover:text-white'}`}>Active Openings</button>
              <button onClick={() => setCurrentTab('profile')} className={`text-xs font-bold transition-all pb-1 border-b-2 ${currentTab === 'profile' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-300 hover:text-white'}`}>🏢 Company Profile</button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={onSwitchMode} className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-2">
              👤 <span className="hidden md:inline">Switch to Job Seeker Portal</span>
            </button>
            <button onClick={onLogout} className="text-xs font-bold text-red-400 hover:text-red-300">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        
        {currentTab === 'overview' && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">Recruiter Hub Active</span>
                <h2 className="text-3xl font-black mt-2">Welcome, {profileData.employer_name}</h2>
                <p className="text-slate-300 text-sm mt-1 max-w-xl">
                  Representing <strong className="text-amber-400">{profileData.company_name}</strong> (GST: {metrics.company_gst}). Manage your active requisitions and candidate pipelines.
                </p>
              </div>
              <button onClick={() => setCurrentTab('post-job')} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs shadow-lg transition-all flex items-center gap-2 hover:scale-105">
                + Post New Opening 🚀
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Job Postings</span>
                <p className="text-3xl font-black text-blue-600 mt-1">{metrics.active_postings}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Applications</span>
                <p className="text-3xl font-black text-indigo-600 mt-1">{metrics.total_applications}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Shortlisted</span>
                <p className="text-3xl font-black text-emerald-600 mt-1">{metrics.shortlisted}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company GST</span>
                <p className="text-sm font-black text-amber-600 mt-2 truncate">{metrics.company_gst}</p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'post-job' && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-900">Create a New Job Listing</h2>
              <p className="text-xs text-slate-500 mt-1">Posting on behalf of <strong className="text-slate-800">{profileData.company_name}</strong>.</p>
            </div>

            <form onSubmit={handlePostJobSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Job Title *</label>
                  <input type="text" required value={newJob.title} onChange={(e) => setNewJob({...newJob, title: e.target.value})} placeholder="e.g. Senior Machine Learning Engineer" className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Company Name *</label>
                  <input type="text" required value={newJob.company_name} onChange={(e) => setNewJob({...newJob, company_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Location / Workplace Type</label>
                  <input type="text" value={newJob.location} onChange={(e) => setNewJob({...newJob, location: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Experience Level</label>
                  <input type="text" value={newJob.minExperienceRequired} onChange={(e) => setNewJob({...newJob, minExperienceRequired: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Required Skills (Comma separated)</label>
                <input type="text" value={newJob.skills} onChange={(e) => setNewJob({...newJob, skills: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Job Description *</label>
                <textarea required rows={6} value={newJob.description} onChange={(e) => setNewJob({...newJob, description: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-blue-600 font-medium resize-none" />
              </div>

              <button type="submit" disabled={posting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-sm shadow-lg transition-all mt-2 disabled:opacity-50">
                {posting ? "Indexing & Publishing Listing..." : "Publish Job Listing 🚀"}
              </button>
            </form>
          </div>
        )}

        {currentTab === 'listings' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-200">
            <h2 className="text-2xl font-black text-slate-900">Active Job Postings</h2>
            {jobsPosted.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500 font-medium text-sm">
                No active jobs posted yet.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {jobsPosted.map((job, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{job.title}</h3>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">{job.company_name} • 📍 {job.location || 'Remote'}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Active</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentTab === 'profile' && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-900">Company & Recruiter Profile</h2>
              <p className="text-xs text-slate-500 mt-1">Manage corporate entity details, GST verification, and recruiter contact info.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Company Name</label>
                  <input type="text" value={profileData.company_name} onChange={(e) => setProfileData({...profileData, company_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Recruiter / Employer Name</label>
                  <input type="text" value={profileData.employer_name} onChange={(e) => setProfileData({...profileData, employer_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">GST Number</label>
                  <input type="text" value={profileData.gst_number} onChange={(e) => setProfileData({...profileData, gst_number: e.target.value})} placeholder="e.g. 29AAAAA0000A1Z5" className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Industry Sector</label>
                  <input type="text" value={profileData.industry} onChange={(e) => setProfileData({...profileData, industry: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Corporate Website</label>
                  <input type="text" value={profileData.website} onChange={(e) => setProfileData({...profileData, website: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Contact Phone</label>
                  <input type="text" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Headquarters Location</label>
                <input type="text" value={profileData.location} onChange={(e) => setProfileData({...profileData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-3.5 rounded-xl text-sm outline-none focus:border-amber-500 font-medium" />
              </div>

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-xl text-sm shadow-lg transition-all mt-2">
                Save Company Profile 💾
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}