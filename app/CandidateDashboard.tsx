'use client';

import { useState, useEffect, ReactNode } from 'react';
import AICareerCoach from './AICareerCoach';
import UpdateUserDetails from './UpdateUserDetails';

type Props = {
  user: { email: string; isGuest: boolean };
  onSwitchMode: () => void;
  onLogout: () => void;
};

// --- Helper function to turn raw text and markdown into beautiful React HTML ---
const formatBold = (str: string): ReactNode[] => {
  const parts = str.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-black text-slate-800">{part}</strong> : part
  );
};

const renderFormattedDescription = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine === '') return <div key={index} className="h-3"></div>;

    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
      const content = trimmedLine.replace(/^[-•]\s*/, '');
      return (
        <ul key={index} className="list-disc ml-5 mb-1.5 marker:text-blue-500">
          <li className="pl-1">{formatBold(content)}</li>
        </ul>
      );
    }

    if (trimmedLine.endsWith(':') || trimmedLine.endsWith(':**')) {
      return <h4 key={index} className="font-bold text-slate-900 mt-4 mb-2 text-base">{formatBold(trimmedLine)}</h4>;
    }

    return <p key={index} className="mb-2 leading-relaxed">{formatBold(trimmedLine)}</p>;
  });
};

export default function CandidateDashboard({ user, onSwitchMode, onLogout }: Props) {
  const [currentView, setCurrentView] = useState<'jobs' | 'profile' | 'applications' | 'saved' | 'analytics' | 'prep'>('jobs');
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedResumeText, setExtractedResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // State for AI Recommended Jobs and Match Tier
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [matchTier, setMatchTier] = useState<'Free' | 'Pro'>('Free');

  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [applyStep, setApplyStep] = useState<'details' | 'form'>('details');
  const [coverLetter, setCoverLetter] = useState('');
  const [generatingLetter, setGeneratingLetter] = useState(false);
  
  // Premium State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [requestingKit, setRequestingKit] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [atsScore, setAtsScore] = useState<{score: number, feedback: string} | null>(null);
  const [scoring, setScoring] = useState(false);

  // Interview Hub / Prep State
  const [prepTab, setPrepTab] = useState<'applied' | 'shortlisted' | 'saved'>('applied');
  const [activePrepJob, setActivePrepJob] = useState<any | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<string>('');
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Filters State
  const [sourceFilter, setSourceFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [jobTypeFilter, setJobTypeFilter] = useState('All');
  const [expYearsFilter, setExpYearsFilter] = useState('All');
  const [skillFilter, setSkillFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [datePostedFilter, setDatePostedFilter] = useState('All');
  const [workplaceFilter, setWorkplaceFilter] = useState('All');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('All');

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'Add Your Name', title: 'Add Current Role', location: 'Add Location', phone: '+91 Add Number', 
    skills: ['React', 'Python', 'Machine Learning', 'Next.js'], bio: 'Add a brief summary of your professional background and career goals.', is_premium: false
  });

  // Added Job Dekho as primary source filter
  const uniqueSources = ['Job Dekho', 'LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Glassdoor', 'Foundit', 'BeBee', 'Shine'];
  const uniqueLocations = ['Bengaluru', 'Pune', 'Hyderabad', 'Mumbai', 'Noida', 'Gurugram', 'Chennai', 'Delhi'];
  const uniqueSkills = ['Python', 'React', 'Java', 'SQL', 'Node.js', 'AWS', 'Machine Learning'];

  const quickSearchOptions = ['Software Engineer', 'Machine Learning', 'React.js', 'Data Scientist', 'Remote', 'Internship'];

  const normalizePlatform = (via: string) => {
    if (!via) return 'Other';
    const v = via.toLowerCase();
    if (v.includes('direct employer') || v.includes('job dekho')) return 'Job Dekho';
    if (v.includes('linkedin')) return 'LinkedIn';
    if (v.includes('naukri')) return 'Naukri';
    if (v.includes('indeed')) return 'Indeed';
    if (v.includes('internshala')) return 'Internshala';
    if (v.includes('foundit') || v.includes('monster')) return 'Foundit';
    return via.replace(/^via\s+/i, '').replace(/\.(com|in|org|net|co\.in)$/i, '').trim();
  };

  useEffect(() => {
    if (user && !user.isGuest) {
      fetch(`http://localhost:8000/api/user/profile?email=${user.email}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setProfileData(data.data);
            if (data.data.resume_text) setExtractedResumeText(data.data.resume_text);
            if (data.data.resume_filename) setResumeFileName(data.data.resume_filename);
          }
        });

      fetch(`http://localhost:8000/api/user/applications?email=${user.email}`)
        .then(res => res.json())
        .then(data => { if (data.success) setAppliedJobs(data.data); });

      fetch(`http://localhost:8000/api/user/saved?email=${user.email}`)
        .then(res => res.json())
        .then(data => { if (data.success) setSavedJobs(data.data); });

      fetch(`http://localhost:8000/api/user/notifications?email=${user.email}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNotifications(data.notifications);
            setUnreadCount(data.unread_count);
          }
        });
    }
  }, [user]);

  const markNotificationsAsRead = async () => {
    if (unreadCount === 0) return;
    setUnreadCount(0);
    await fetch('http://localhost:8000/api/user/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    });
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const queryParams = new URLSearchParams({
      source: sourceFilter, category: categoryFilter, jobType: jobTypeFilter, expYears: expYearsFilter, skill: skillFilter, location: locationFilter, datePosted: datePostedFilter, workplaceType: workplaceFilter, employmentType: employmentTypeFilter, search: submittedSearch, page: '1'
    });

    fetch(`http://localhost:8000/api/jobs?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const processedJobs = data.data.map((job: any) => ({ ...job, normalizedSource: normalizePlatform(job.via) }));
          setJobs(processedJobs);
          setHasMore(data.hasMore);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sourceFilter, categoryFilter, jobTypeFilter, expYearsFilter, skillFilter, locationFilter, datePostedFilter, workplaceFilter, employmentTypeFilter, submittedSearch]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const queryParams = new URLSearchParams({ source: sourceFilter, category: categoryFilter, jobType: jobTypeFilter, expYears: expYearsFilter, skill: skillFilter, location: locationFilter, datePosted: datePostedFilter, workplaceType: workplaceFilter, employmentType: employmentTypeFilter, search: submittedSearch, page: String(nextPage) });
      const res = await fetch(`http://localhost:8000/api/jobs?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        const moreJobs = data.data.map((job: any) => ({ ...job, normalizedSource: normalizePlatform(job.via) }));
        setJobs(prev => [...prev, ...moreJobs]);
        setPage(nextPage);
        setHasMore(data.hasMore);
      }
    } finally { setLoadingMore(false); }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(searchQuery);
  };

  // Enhanced Interactive Quick Filter Toggle Logic
  const handleQuickSearch = (term: string) => {
    if (searchQuery === term) {
      // Toggle off if already selected
      setSearchQuery('');
      setSubmittedSearch('');
    } else {
      // Toggle on
      setSearchQuery(term);
      setSubmittedSearch(term);
    }
  };

  const resetAllFilters = () => {
    setSourceFilter('All');
    setCategoryFilter('All');
    setJobTypeFilter('All');
    setExpYearsFilter('All');
    setSkillFilter('All');
    setLocationFilter('All');
    setDatePostedFilter('All');
    setWorkplaceFilter('All');
    setEmploymentTypeFilter('All');
    setSubmittedSearch('');
    setSearchQuery('');
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name); 
    setAnalyzing(true);
    
    const formData = new FormData(); 
    formData.append('resume', file);

    if (!user.isGuest) {
      formData.append('email', user.email);
      formData.append('is_premium', String(profileData.is_premium));
    }
    
    try {
      const response = await fetch('http://localhost:8000/api/resume', { 
        method: 'POST', 
        body: formData 
      });
      
      const data = await response.json();
      if (data.success) {
        const parsedText = data.resumeText || "Resume parsed successfully.";
        setExtractedResumeText(parsedText);
        
        if (data.matches) {
          setRecommendedJobs(data.matches);
          setMatchTier(data.tier || 'Free');
        }

        if (!user.isGuest) {
          await fetch('http://localhost:8000/api/user/profile', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ...profileData, email: user.email, resume_text: parsedText, resume_filename: file.name }) 
          });
        }
      } else {
        alert(`Failed: ${data.detail || data.error}`);
      }
    } catch (err) { 
        alert("Network error."); 
    } finally { 
        setAnalyzing(false); 
    }
  };

  const handleInlineSaveProfile = async () => {
    if (user.isGuest) return;
    try {
      await fetch('http://localhost:8000/api/user/profile', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...profileData, email: user.email, resume_text: extractedResumeText, resume_filename: resumeFileName }) 
      });
    } catch (err) { console.error("Background save failed."); }
  };

  const removeSkill = (skillToRemove: string) => {
    setProfileData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skillToRemove) }));
  };

  const toggleSaveJob = async (job: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user.isGuest) return alert("Login to save jobs.");
    const jobId = job._id || job.job_id;
    const payload = { email: user.email, job_id: jobId, title: job.title, company_name: job.company_name, location: job.location || 'Remote' };
    try {
      const res = await fetch('http://localhost:8000/api/user/saved/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        if (data.action === 'removed') setSavedJobs(savedJobs.filter(j => j.job_id !== jobId));
        else setSavedJobs([...savedJobs, payload]);
      }
    } catch (err) { console.error(err); }
  };

  const handleGenerateCoverLetter = async () => {
    if (!extractedResumeText) return alert("Upload resume first.");
    setGeneratingLetter(true);
    
    const payload = {
      resume_text: extractedResumeText,
      job_title: selectedJob.title || "Job Role",
      company_name: selectedJob.company_name || "Company",
      job_description: selectedJob.description || selectedJob.formattedDescription || "Standard job description"
    };

    try {
      const res = await fetch('http://localhost:8000/api/resume/cover-letter', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (data.success) {
        setCoverLetter(data.cover_letter);
      } else {
        alert(data.detail || "Failed to generate cover letter.");
      }
    } catch (err) { 
      alert("Error generating cover letter."); 
    } finally { 
      setGeneratingLetter(false); 
    }
  };

  const submitApplication = async () => {
    const payload = { email: user.email, job_id: selectedJob._id || selectedJob.job_id, title: selectedJob.title, company_name: selectedJob.company_name, location: selectedJob.location || 'Remote', appliedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Under Review' };
    try {
      const res = await fetch('http://localhost:8000/api/user/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if ((await res.json()).success) {
        setAppliedJobs([payload, ...appliedJobs]);
        alert(`Successfully applied!`);
        setSelectedJob(null); setApplyStep('details'); setCoverLetter(''); setAtsScore(null); setCurrentView('applications');
      }
    } catch (err) { alert("Failed to record application."); }
  };

  const handleWithdrawApplication = async (jobId: string) => {
    if (user.isGuest || !window.confirm("Withdraw application?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/user/applications?email=${user.email}&job_id=${jobId}`, { method: 'DELETE' });
      if ((await res.json()).success) { setAppliedJobs(appliedJobs.filter(j => j.job_id !== jobId)); alert("Withdrawn."); }
    } catch (err) {}
  };

  const handleUpgradeAction = () => {
    if (user.isGuest) {
      if (window.confirm("Please sign up or log in to unlock Job Dekho Premium features! Would you like to sign up now?")) {
        onLogout(); 
      }
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSubmit = async () => {
    setProcessingPayment(true);
    setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:8000/api/premium/checkout', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ email: user.email, token: "tok_mockStripe123" }) 
        });
        const data = await res.json();
        if (data.success) { 
          setProfileData({ ...profileData, is_premium: true }); 
          setShowPaymentModal(false); 
          alert("Payment Successful! Premium Features Unlocked. 👑"); 
        }
      } catch (err) {
        alert("Payment failed.");
      } finally { 
        setProcessingPayment(false); 
      }
    }, 1500);
  };

  const handleRequestInterviewKit = async (jobTitle: string, companyName: string, jobDesc: string) => {
    if (user.isGuest) {
      if (window.confirm("Please sign up or log in to request AI Interview Kits! Would you like to sign up now?")) {
        onLogout();
      }
      return;
    }
    if (!profileData.is_premium) return setShowPaymentModal(true);
    if (!extractedResumeText) return alert("Upload resume first.");
    setRequestingKit(true);
    try {
      const res = await fetch('http://localhost:8000/api/premium/interview-kit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email: user.email, job_title: jobTitle, company_name: companyName, job_description: jobDesc || "Standard role requirements", resume_text: extractedResumeText }) 
      });
      if ((await res.json()).success) alert("📧 Interview Prep Starter Kit generated and emailed successfully!");
    } catch (err) {
      alert("Failed to email starter kit.");
    } finally { 
      setRequestingKit(false); 
    }
  };

  const handleGenerateTopQuestions = async (job: any) => {
    setGeneratingQuestions(true);
    setActivePrepJob(job);
    setGeneratedQuestions('');
    try {
      const res = await fetch('http://localhost:8000/api/premium/top-technical-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: job.title,
          company_name: job.company_name,
          job_description: job.description || job.formattedDescription || "Standard role description"
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedQuestions(data.questions);
      } else {
        setGeneratedQuestions("Failed to generate questions.");
      }
    } catch (err) {
      setGeneratedQuestions("Network error generating questions.");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleGetAtsScore = async () => {
    if (user.isGuest) {
      if (window.confirm("Please sign up or log in to check ATS match scores! Would you like to sign up now?")) {
        onLogout();
      }
      return;
    }
    if (!profileData.is_premium) return setShowPaymentModal(true);
    if (!extractedResumeText) return alert("Upload resume first.");
    setScoring(true);
    try {
      const res = await fetch('http://localhost:8000/api/premium/ats-score', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          email: user.email, 
          job_title: selectedJob.title, 
          company_name: selectedJob.company_name, 
          job_description: selectedJob.description || selectedJob.formattedDescription || "Standard role description", 
          resume_text: extractedResumeText 
        }) 
      });
      const data = await res.json();
      if (data.success) {
        setAtsScore({ score: data.score, feedback: data.feedback });
      } else {
        alert(data.error || "Failed to calculate ATS score.");
      }
    } catch (err) {
      alert("Network error calculating ATS score.");
    } finally { 
      setScoring(false); 
    }
  };

  const handleAutoApply = async () => {
    if (user.isGuest) {
      if (window.confirm("Please sign up or log in to use 1-Click Auto-Apply! Would you like to sign up now?")) {
        onLogout();
      }
      return;
    }
    if (!profileData.is_premium) return setShowPaymentModal(true);
    if (!extractedResumeText) return alert("Upload resume first.");
    setAutoApplying(true);
    try {
      const res = await fetch('http://localhost:8000/api/premium/auto-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, job_id: selectedJob._id || selectedJob.job_id, job_title: selectedJob.title, company_name: selectedJob.company_name, location: selectedJob.location || 'Remote', job_description: selectedJob.description || selectedJob.formattedDescription, resume_text: extractedResumeText }) });
      const data = await res.json();
      if (data.success) {
        setAppliedJobs([{ email: user.email, job_id: selectedJob._id || selectedJob.job_id, title: selectedJob.title, company_name: selectedJob.company_name, location: selectedJob.location || 'Remote', appliedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Auto-Applied ⚡' }, ...appliedJobs]);
        alert("⚡ Auto-Apply initiated!"); setSelectedJob(null); setCurrentView('applications');
      } else alert(data.error || "Failed.");
    } catch (err) {} finally { setAutoApplying(false); }
  };

  const currentPrepJobList = prepTab === 'applied' ? appliedJobs : prepTab === 'shortlisted' ? appliedJobs.filter(j => j.status?.includes('Shortlisted')) : savedJobs;

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-slate-800 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-black text-blue-600 tracking-tighter cursor-pointer" onClick={() => setCurrentView('jobs')}>Job Dekho</h1>
            <div className="hidden md:flex gap-6">
              <button onClick={() => setCurrentView('jobs')} className={`text-sm font-semibold border-b-2 transition-all ${currentView === 'jobs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-blue-600'}`}>Jobs</button>
              {!user.isGuest && <button onClick={() => setCurrentView('applications')} className={`text-sm font-semibold border-b-2 transition-all ${currentView === 'applications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-blue-600'}`}>Applied ({appliedJobs.length})</button>}
              {!user.isGuest && <button onClick={() => setCurrentView('saved')} className={`text-sm font-semibold border-b-2 transition-all ${currentView === 'saved' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-blue-600'}`}>Saved ({savedJobs.length})</button>}
              {!user.isGuest && <button onClick={() => setCurrentView('analytics')} className={`text-sm font-semibold border-b-2 transition-all ${currentView === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-blue-600'}`}>Analytics</button>}
              {!user.isGuest && profileData.is_premium && (
                <button onClick={() => setCurrentView('prep')} className={`text-sm font-semibold border-b-2 transition-all flex items-center gap-1 ${currentView === 'prep' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-600 hover:text-amber-600'}`}>
                  👑 Interview Hub
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
              
            {(!profileData.is_premium) && (
              <button onClick={handleUpgradeAction} className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:scale-105 transition-all">
                👑 Upgrade
              </button>
            )}
            
            {!user.isGuest && (
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowNotifDropdown(!showNotifDropdown);
                    markNotificationsAsRead();
                  }} 
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 relative transition-colors"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h4 className="font-bold text-slate-800 text-sm">Notifications</h4>
                      <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">{notifications.length} Total</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">No notifications yet.</div>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex flex-col gap-1 text-left">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-900">{n.title}</span>
                              <span className="text-[10px] text-slate-400">{n.created_at}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!user.isGuest ? (
              <button onClick={() => setCurrentView('profile')} className="flex items-center gap-2 hover:bg-slate-50 p-2 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs relative">{user.email.charAt(0).toUpperCase()}{profileData.is_premium && <span className="absolute -top-1 -right-1 text-sm">👑</span>}</div>
                <div className="text-left hidden sm:block"><p className="text-xs font-bold text-slate-700 leading-tight">My Profile</p></div>
              </button>
            ) : (
              <button onClick={onLogout} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-blue-700">Sign Up / Login</button>
            )}
            {!user.isGuest && <button onClick={onLogout} className="text-xs font-bold text-slate-500 hover:text-red-600">Logout</button>}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8 flex-1 w-full">
        
        {/* JOBS FEED */}
        {currentView === 'jobs' && (
          <div className="flex flex-col lg:flex-row gap-8 pb-32">
            <aside className="w-full lg:w-1/4 flex flex-col gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5 sticky top-24">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800">⚙️ All Filters</h3>
                  <button onClick={resetAllFilters} className="text-xs text-blue-600 font-bold hover:underline">Clear</button>
                </div>
                
                {/* Portal / Source Filter added here */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Portal</label>
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer">
                    <option value="All">All Portals</option>
                    {uniqueSources.map(source => <option key={source} value={source}>{source}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label><select value={datePostedFilter} onChange={(e) => setDatePostedFilter(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"><option value="All">Any Time</option><option value="24h">Past 24 Hours</option><option value="week">Past Week</option><option value="month">Past Month</option></select></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Experience</label><select value={expYearsFilter} onChange={(e) => setExpYearsFilter(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"><option value="All">Any Experience</option><option value="0-1">0 - 1 Years</option><option value="1-3">1 - 3 Years</option><option value="3-5">3 - 5 Years</option><option value="5+">5+ Years</option></select></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label><select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"><option value="All">All</option>{uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</select></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skill</label><select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"><option value="All">All</option>{uniqueSkills.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
            </aside>

            <div className="w-full lg:w-3/4 flex flex-col gap-6">
              
              <div className="bg-white p-2 border border-slate-200 rounded-full shadow-sm flex items-center gap-2">
                <div className="pl-4 text-slate-400">🔍</div>
                <form onSubmit={handleSearchSubmit} className="flex-1 flex">
                  <input type="text" placeholder="Search skills, titles, or companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-sm p-2 text-slate-700 bg-transparent" />
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-blue-700">Search</button>
                </form>
              </div>

              {/* Enhanced Interactive Quick Filters */}
              <div className="flex flex-wrap items-center gap-2 -mt-2 mb-2 px-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Suggested:</span>
                {quickSearchOptions.map(term => (
                  <button
                    key={term}
                    onClick={() => handleQuickSearch(term)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all shadow-sm border 
                      ${searchQuery === term 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 scale-105' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
                      }`}
                  >
                    {term} {searchQuery === term && <span className="ml-1 opacity-70">✕</span>}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="text-center py-20 text-slate-400 font-semibold animate-pulse">Scanning available opportunities...</div>
              ) : jobs.length === 0 ? (
                /* Enhanced Empty State when filters return 0 jobs */
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in">
                  <div className="text-5xl mb-2">🔍</div>
                  <h3 className="text-xl font-bold text-slate-800">No Jobs Found</h3>
                  <p className="text-sm text-slate-500 max-w-sm">We couldn't find any roles matching your exact filters. Try broadening your search criteria.</p>
                  <button onClick={resetAllFilters} className="mt-4 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-slate-800">
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {jobs.map(job => {
                    const isSaved = savedJobs.some(j => j.job_id === (job._id || job.job_id));
                    return (
                      <div key={job._id || job.job_id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-black text-slate-900 hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedJob(job); setApplyStep('details'); setCoverLetter(''); setAtsScore(null); }}>{job.title}</h3>
                            <p className="text-sm text-slate-600 font-semibold">{job.company_name}</p>
                          </div>
                          <button onClick={(e) => toggleSaveJob(job, e)} className="text-2xl hover:scale-110">{isSaved ? <span className="text-blue-600">★</span> : <span className="text-slate-300">☆</span>}</button>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 font-medium">
                          <span>💼 {job.minExperienceRequired || '0-5 Yrs'}</span><span>📍 {job.location || 'Remote'}</span><span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">🌐 {job.normalizedSource}</span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 mt-1">{job.description || job.formattedDescription}</p>
                        <div className="flex justify-between items-center mt-3 pt-4 border-t border-slate-100">
                          <button onClick={() => { setSelectedJob(job); setApplyStep('details'); setCoverLetter(''); setAtsScore(null); }} className="text-blue-600 font-bold text-xs hover:underline">View Details</button>
                          <button onClick={() => { if (user.isGuest) return alert("Login required."); setSelectedJob(job); setApplyStep('form'); }} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-blue-700">Smart Apply</button>
                        </div>
                      </div>
                    );
                  })}
                  {hasMore && <button onClick={handleLoadMore} disabled={loadingMore} className="mt-6 bg-slate-900 text-white font-bold py-3.5 rounded-xl text-sm self-center px-12">{loadingMore ? 'Loading...' : 'Load More'}</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* NAUKRI-STYLE REDESIGNED INTERACTIVE PROFILE VIEW */}
        {currentView === 'profile' && !user.isGuest && (
          <div className="flex flex-col gap-6 pb-32">
            
            {/* TOP PROFILE CARD */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Circular Progress Avatar */}
                <div className="relative shrink-0 flex justify-center mt-2">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * 85) / 100} className="text-emerald-500 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-28 h-28 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-inner">
                      {profileData.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 bg-white text-emerald-600 text-[10px] font-black px-3 py-0.5 rounded-full border border-emerald-200 shadow-sm z-10">
                    85%
                  </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 w-full text-center md:text-left">
                  <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 flex items-center justify-center md:justify-start gap-3">
                        {profileData.name} 
                        
                        {/* UPDATE PROFILE BUTTON */}
                        <button 
                          onClick={() => setShowUpdateModal(true)} 
                          className="text-blue-500 text-xs hover:bg-blue-50 p-1.5 rounded-full transition-colors" 
                          title="Edit Profile"
                        >
                          ✏️
                        </button>
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">Profile last updated - Today</p>
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-100 my-4"></div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-base">📍</span> 
                      <span>{profileData.location}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-base">📞</span> 
                      <span>{profileData.phone}</span>
                      <span className="text-emerald-500 font-bold ml-auto bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">Verified ✓</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-base">💼</span> 
                      <span className="font-bold text-slate-800">{profileData.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-base">✉️</span> 
                      <span>{user.email}</span>
                      <span className="text-emerald-500 font-bold ml-auto bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">Verified ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN LAYOUT */}
            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* LEFT SIDEBAR: Quick Links */}
              <div className="w-full lg:w-1/4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sticky top-24">
                  <h3 className="font-bold text-slate-900 text-sm mb-4">Quick links</h3>
                  <ul className="flex flex-col text-xs font-semibold text-slate-500 space-y-4">
                    <li className="text-blue-600 border-l-[3px] border-blue-600 pl-3 cursor-pointer">Resume</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Resume headline</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Key skills</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Employment</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Education</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">IT skills</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Projects</li>
                    <li className="pl-3 hover:text-blue-600 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-blue-200">Profile summary</li>
                  </ul>
                </div>
              </div>

              {/* RIGHT CONTENT AREA */}
              <div className="w-full lg:w-3/4 flex flex-col gap-6">
                
                {/* Premium / Upgrade Banner */}
                {!profileData.is_premium ? (
                  <div className="bg-gradient-to-r from-[#fffbf0] to-[#fff5d6] border border-[#fce49c] rounded-2xl p-4 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black italic text-amber-600 tracking-tighter pr-4 border-r border-amber-200">Job Dekho<span className="text-amber-500">Pro</span></span>
                      <span className="text-sm font-bold text-slate-800">Power up with AI keyword insights & ATS Scoring</span>
                    </div>
                    <button onClick={handleUpgradeAction} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-transform flex items-center gap-2">
                      👑 Become a Pro <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-sm">25% off</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-slate-900 to-blue-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black italic text-white tracking-tighter pr-4 border-r border-slate-700">Job Dekho<span className="text-blue-400">Pro</span></span>
                      <span className="text-sm font-bold text-slate-300">👑 Premium AI Features Active</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">Subscription Verified</span>
                  </div>
                )}

                {/* Resume Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                  <h3 className="font-black text-slate-900 text-base">Resume</h3>
                  
                  {resumeFileName ? (
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-blue-600 hover:underline cursor-pointer">{resumeFileName}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">Uploaded successfully • Indexed for AI Matching</p>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <button className="hover:text-blue-600 transition-colors" title="Download">⬇️</button>
                        <button onClick={() => {setResumeFileName(null); setExtractedResumeText(''); setRecommendedJobs([]);}} className="hover:text-red-500 transition-colors" title="Delete">🗑️</button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-center items-center text-sm text-slate-500 font-medium h-20">
                      No resume uploaded yet.
                    </div>
                  )}
                  
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 bg-white transition-colors hover:bg-slate-50">
                    {analyzing ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-sm font-bold text-blue-600">Extracting text & analyzing via Gemini...</div>
                      </div>
                    ) : (
                      <>
                        <label className="text-blue-600 border border-blue-600 hover:bg-blue-50 px-6 py-2 rounded-full text-xs font-bold cursor-pointer transition-colors mb-3">
                          Update resume
                          <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={handleResumeUpload} className="hidden" />
                        </label>
                        <p className="text-[10px] text-slate-400 font-medium">Supported Formats: doc, docx, rtf, pdf, upto 2 MB</p>
                      </>
                    )}
                  </div>
                </div>

                {/* AI RECOMMENDED JOBS SECTION */}
                {recommendedJobs.length > 0 && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900">
                        AI Recommended Jobs ({recommendedJobs.length})
                      </h3>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${matchTier === 'Pro' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {matchTier === 'Pro' ? '👑 Pro 10-Job Deep Match' : 'Standard 2-Job Match'}
                      </span>
                    </div>

                    <div className="grid gap-4">
                      {recommendedJobs.map((job) => (
                        <div key={job._id || job.job_id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="text-lg font-black text-slate-900 hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedJob(job); setApplyStep('details'); setCoverLetter(''); setAtsScore(null); }}>{job.title}</h4>
                              <p className="text-sm font-semibold text-slate-600 mt-1">{job.company_name} • {job.location}</p>
                            </div>
                            {job.ai_insights?.match_score && (
                              <div className="text-right shrink-0">
                                <span className="inline-block px-3 py-1.5 bg-emerald-50 text-emerald-700 font-black text-sm rounded-lg border border-emerald-200 shadow-sm">
                                  {job.ai_insights.match_score}% Match
                                </span>
                              </div>
                            )}
                          </div>

                          {job.ai_insights && (
                            <>
                              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm text-indigo-950">
                                <p className="font-bold flex items-center gap-1.5"><span className="text-base">💡</span> Fit Summary</p>
                                <p className="mt-1.5 text-slate-700 leading-relaxed font-medium">{job.ai_insights.rephrased_pitch}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Skills:</span>
                                {job.ai_insights.matching_skills?.map((s: string, idx: number) => (
                                  <span key={`match-${idx}`} className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold">
                                    ✓ {s}
                                  </span>
                                ))}
                                {job.ai_insights.missing_skills?.map((s: string, idx: number) => (
                                  <span key={`miss-${idx}`} className="text-xs px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold">
                                    + {s}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                          
                          <div className="flex justify-between items-center mt-2 pt-4 border-t border-slate-100">
                            <button onClick={() => { setSelectedJob(job); setApplyStep('details'); setCoverLetter(''); setAtsScore(null); }} className="text-blue-600 font-bold text-xs hover:underline">View Details</button>
                            <button onClick={() => { setSelectedJob(job); setApplyStep('form'); }} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-blue-700 shadow-sm">Smart Apply</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume Headline / Bio Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base">Resume headline</h3>
                    <button className="text-blue-500 text-xs hover:bg-blue-50 p-1 rounded-full transition-colors" title="Edit Headline">✏️</button>
                  </div>
                  <textarea 
                    value={profileData.bio} 
                    onChange={(e) => setProfileData({...profileData, bio: e.target.value})} 
                    onBlur={handleInlineSaveProfile}
                    rows={3} 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-blue-400 focus:bg-white font-medium text-slate-700 resize-none transition-colors leading-relaxed"
                    placeholder="Add a brief summary of your professional background..."
                  />
                </div>

                {/* Key Skills Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-base">Key skills</h3>
                    <button className="text-blue-500 text-xs hover:bg-blue-50 p-1 rounded-full transition-colors" title="Edit Skills">✏️</button>
                  </div>
                  
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      id="newSkillInputNaukri" 
                      placeholder="Add a new skill (e.g. LLM, Data Science)..." 
                      className="flex-1 bg-white border border-slate-300 px-4 py-2 rounded-lg text-xs outline-none focus:border-blue-500 font-medium" 
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          const val = (e.target as HTMLInputElement).value.trim(); 
                          if (val && !profileData.skills.includes(val)) { 
                            setProfileData({...profileData, skills: [...profileData.skills, val]}); 
                            (e.target as HTMLInputElement).value = ''; 
                            setTimeout(handleInlineSaveProfile, 100);
                          } 
                        } 
                      }} 
                    />
                    <button 
                      onClick={() => { 
                        const input = document.getElementById('newSkillInputNaukri') as HTMLInputElement; 
                        const val = input?.value.trim(); 
                        if (val && !profileData.skills.includes(val)) { 
                          setProfileData({...profileData, skills: [...profileData.skills, val]}); 
                          input.value = ''; 
                          setTimeout(handleInlineSaveProfile, 100);
                        } 
                      }} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {profileData.skills.map((skill, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-semibold px-4 py-2 rounded-full shadow-sm hover:border-slate-400 transition-colors">
                        {skill}
                        <button onClick={() => {removeSkill(skill); setTimeout(handleInlineSaveProfile, 100);}} className="text-slate-400 hover:text-red-500 ml-1 leading-none text-base">&times;</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Placeholder Cards for Future Sections */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
                  <h3 className="font-black text-slate-900 text-base">Employment</h3>
                  <button className="text-blue-600 font-bold text-xs hover:underline">Add employment</button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
                  <h3 className="font-black text-slate-900 text-base">Education</h3>
                  <button className="text-blue-600 font-bold text-xs hover:underline">Add education</button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* APPLIED JOBS VIEW */}
        {currentView === 'applications' && !user.isGuest && (
          <div className="max-w-4xl mx-auto pb-32">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Application History</h2>
            {appliedJobs.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border text-center"><p className="text-slate-500 text-sm">No applications recorded yet.</p></div>
            ) : (
              <div className="flex flex-col gap-4">
                {appliedJobs.map((job, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-50 border flex justify-center items-center font-bold text-slate-400">{job.company_name.charAt(0)}</div>
                      <div><h3 className="font-bold text-blue-600">{job.title}</h3><p className="text-sm">{job.company_name} • Applied: {job.appliedAt}</p></div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{job.status}</span>
                      <button onClick={() => handleWithdrawApplication(job.job_id)} className="text-red-400 hover:text-red-600 text-xs font-semibold mt-1">Withdraw</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SAVED JOBS VIEW */}
        {currentView === 'saved' && !user.isGuest && (
          <div className="max-w-4xl mx-auto pb-32">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Saved Jobs</h2>
            {savedJobs.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border text-center"><p className="text-slate-500 text-sm">No saved jobs.</p></div>
            ) : (
              <div className="flex flex-col gap-4">
                {savedJobs.map(job => (
                  <div key={job.job_id} className="bg-white p-5 rounded-xl border border-slate-200 relative flex flex-col gap-2">
                    <button onClick={(e) => toggleSaveJob(job, e)} className="absolute top-4 right-5 text-2xl text-blue-600">★</button>
                    <h3 className="text-lg font-black text-slate-900 pr-8">{job.title}</h3>
                    <p className="text-sm font-bold text-slate-700">{job.company_name} • 📍 {job.location || 'Remote'}</p>
                    <div className="flex justify-end gap-3 mt-2 border-t pt-3">
                      <button onClick={() => { setSelectedJob(job); setApplyStep('details'); setAtsScore(null); }} className="text-blue-600 font-bold text-xs hover:underline">View Details</button>
                      <button onClick={() => { setSelectedJob(job); setApplyStep('form'); }} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-xs">Smart Apply</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS & INSIGHTS VIEW */}
        {currentView === 'analytics' && !user.isGuest && (
          <div className="pb-32"><CandidateAnalyticsView email={user.email} resumeText={extractedResumeText} /></div>
        )}

        {/* VIEW: PREMIUM INTERVIEW PREP HUB */}
        {currentView === 'prep' && !user.isGuest && profileData.is_premium && (
          <div className="max-w-5xl mx-auto flex flex-col gap-8 animate-in fade-in duration-200 pb-32">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">👑 Premium Exclusive</span>
                </div>
                <h2 className="text-3xl font-black">AI Interview Preparation Hub</h2>
                <p className="text-slate-300 text-sm mt-1 max-w-xl">
                  Generate top 10 technical questions based on your applied, shortlisted, and saved jobs, or request an email starter kit.
                </p>
              </div>
            </div>

            {/* Sub-tabs for Applied, Shortlisted, Saved */}
            <div className="flex gap-3 border-b border-slate-200 pb-4">
              <button onClick={() => setPrepTab('applied')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${prepTab === 'applied' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'}`}>Applied Jobs ({appliedJobs.length})</button>
              <button onClick={() => setPrepTab('shortlisted')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${prepTab === 'shortlisted' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'}`}>Shortlisted Jobs</button>
              <button onClick={() => setPrepTab('saved')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${prepTab === 'saved' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'}`}>Saved Jobs ({savedJobs.length})</button>
            </div>

            {currentPrepJobList.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
                <div className="text-4xl">📂</div>
                <h3 className="text-lg font-bold text-slate-800">No Jobs Found in this Category</h3>
                <p className="text-sm text-slate-500 max-w-sm">Explore the job feed or save roles to generate tailored technical interview questions.</p>
                <button onClick={() => setCurrentView('jobs')} className="mt-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-blue-700">Browse Active Jobs</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {currentPrepJobList.map((job: any, idx: number) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100">{job.status || 'Saved / Target'}</span>
                          <span className="text-xs text-slate-400">• {job.company_name}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">{job.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">📍 {job.location || 'Remote'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => handleGenerateTopQuestions(job)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow transition-all flex items-center gap-2"
                        >
                          <span>⚡ Generate Top 10 Tech Questions</span>
                        </button>
                        <button 
                          onClick={() => handleRequestInterviewKit(job.title, job.company_name, job.description || job.title)}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow transition-all flex items-center gap-2"
                        >
                          <span>📧 Email Prep Starter Kit</span>
                        </button>
                      </div>
                    </div>

                    {/* Expanded LLM Generated Questions Box */}
                    {activePrepJob && (activePrepJob.job_id === job.job_id || activePrepJob._id === job._id) && (
                      <div className="bg-indigo-50/60 border border-indigo-100 p-6 rounded-2xl animate-in fade-in duration-200">
                        <h4 className="font-black text-indigo-950 text-sm mb-3 flex items-center gap-2">
                          <span>🤖</span> Top 10 Technical & System Design Questions for {job.company_name}
                        </h4>
                        {generatingQuestions ? (
                          <div className="py-8 text-center text-indigo-600 font-bold text-xs animate-pulse">
                            Synthesizing role requirements and querying Gemini engine...
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed bg-white p-5 rounded-xl border border-indigo-100 shadow-sm font-medium">
                            {generatedQuestions}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- NAUKRI STYLE FOOTER --- */}
      <footer className="w-full bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Logo and Connect */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <h2 className="text-2xl font-black text-blue-600 tracking-tighter">Job Dekho</h2>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-700">Connect with us</span>
                <div className="flex gap-4 text-slate-400">
                  <span className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center text-[10px] cursor-pointer hover:border-blue-600 hover:text-blue-600 transition-colors">f</span>
                  <span className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center text-[10px] cursor-pointer hover:border-pink-600 hover:text-pink-600 transition-colors">ig</span>
                  <span className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center text-[10px] cursor-pointer hover:border-slate-900 hover:text-slate-900 transition-colors">X</span>
                  <span className="w-6 h-6 border border-slate-300 rounded flex items-center justify-center text-[10px] cursor-pointer hover:border-blue-700 hover:text-blue-700 transition-colors">in</span>
                </div>
              </div>
            </div>

            {/* Links Column 1 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer">About us</li>
                <li className="hover:text-blue-600 cursor-pointer">Careers</li>
                <li className="hover:text-blue-600 cursor-pointer" onClick={onSwitchMode}>Employer home</li>
                <li className="hover:text-blue-600 cursor-pointer">Sitemap</li>
                <li className="hover:text-blue-600 cursor-pointer">Credits</li>
              </ul>
            </div>

            {/* Links Column 2 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer">Help center</li>
                <li className="hover:text-blue-600 cursor-pointer">Summons/Notices</li>
                <li className="hover:text-blue-600 cursor-pointer">Grievances</li>
                <li className="hover:text-blue-600 cursor-pointer">Report issue</li>
              </ul>
            </div>

            {/* Links Column 3 */}
            <div className="lg:col-span-1">
              <ul className="flex flex-col gap-3 text-xs text-slate-600 font-medium">
                <li className="hover:text-blue-600 cursor-pointer">Privacy policy</li>
                <li className="hover:text-blue-600 cursor-pointer">Terms & conditions</li>
                <li className="hover:text-blue-600 cursor-pointer">Fraud alert</li>
                <li className="hover:text-blue-600 cursor-pointer">Trust & safety</li>
              </ul>
            </div>

            {/* App Promotion */}
            <div className="lg:col-span-1">
              <div className="border border-slate-200 p-5 rounded-2xl bg-white shadow-sm flex flex-col gap-3">
                <h3 className="font-black text-slate-800 text-sm">Apply on the go</h3>
                <p className="text-[10px] text-slate-500 mb-2">Get real-time job updates on our App</p>
                <div className="flex gap-2">
                  <div className="bg-slate-900 text-white rounded-lg px-3 py-2 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors w-1/2">
                    <span className="text-[9px] font-bold">Google Play</span>
                  </div>
                  <div className="bg-slate-900 text-white rounded-lg px-3 py-2 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors w-1/2">
                    <span className="text-[9px] font-bold">App Store</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl font-light text-slate-500 tracking-tighter">infoedge</span>
              <div className="flex flex-col text-[10px] text-slate-400 border-l border-slate-200 pl-3">
                <p>All trademarks are the property of their respective owners</p>
                <p>All rights reserved © 2026 Info Edge (India) Ltd.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
              <span>Our businesses</span>
              <span className="cursor-pointer text-slate-700">✅ select</span>
              <span className="text-pink-500 cursor-pointer">minis</span>
              <span className="text-orange-600 cursor-pointer">codingninjas</span>
            </div>
          </div>

        </div>
      </footer>

      {/* RENDER THE UPDATE PROFILE MODAL */}
      <UpdateUserDetails 
        isOpen={showUpdateModal} 
        onClose={() => setShowUpdateModal(false)} 
        userEmail={user.email}
        initialData={profileData}
        onSuccess={(updatedData) => setProfileData(updatedData)}
      />

      {/* MODALS */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div><h2 className="text-2xl font-black">{selectedJob.title}</h2><p className="text-blue-600 font-bold mt-1 text-base">{selectedJob.company_name} • {selectedJob.location}</p></div>
              <button onClick={() => setSelectedJob(null)} className="text-slate-400 text-2xl font-black">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white relative">
              {atsScore && (
                <div className="mb-6 p-5 border border-emerald-200 bg-emerald-50 rounded-xl flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-white border-[4px] border-emerald-400 flex items-center justify-center text-xl font-black text-emerald-600 shrink-0">{atsScore.score}%</div>
                  <div><h4 className="font-bold text-emerald-800">ATS Match Score</h4><p className="text-sm text-emerald-700 mt-1">{atsScore.feedback}</p></div>
                </div>
              )}
              {applyStep === 'details' ? (
                <>
                  <div className="flex justify-between items-center mb-6 p-4 bg-slate-50 border rounded-xl">
                    <div><h4 className="font-bold">👑 Premium Toolkit</h4></div>
                    <div className="flex gap-2">
                      <button onClick={handleGetAtsScore} disabled={scoring} className="bg-white border px-3 py-1.5 rounded-lg text-xs font-bold">{scoring ? "Scoring..." : "📊 Check ATS Score"}</button>
                      <button onClick={() => handleRequestInterviewKit(selectedJob.title, selectedJob.company_name, selectedJob.description)} disabled={requestingKit} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold">{requestingKit ? "Generating..." : "📧 Interview Kit"}</button>
                    </div>
                  </div>
                  
                  <div className="text-slate-600 text-sm">
                    {renderFormattedDescription(selectedJob.formattedDescription || selectedJob.description)}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-between">
                    <div><h4 className="text-sm font-bold text-indigo-900">AI Cover Letter Generator</h4></div>
                    <button onClick={handleGenerateCoverLetter} disabled={generatingLetter} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">✨ Generate Letter</button>
                  </div>
                  <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Cover letter..." className="w-full border p-4 text-sm outline-none h-64 resize-none"></textarea>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
              {applyStep === 'form' ? <button onClick={() => setApplyStep('details')} className="text-slate-500 text-sm font-bold">&larr; Back</button> : <div><button onClick={handleAutoApply} disabled={autoApplying} className="bg-amber-400 text-amber-900 px-6 py-2 rounded-lg font-bold text-sm shadow">⚡ 1-Click Auto-Apply</button></div>}
              <div className="flex gap-3"><button onClick={() => setSelectedJob(null)} className="bg-white border px-6 py-2 rounded-lg font-bold text-sm">Cancel</button>{applyStep === 'details' ? <button onClick={() => setApplyStep('form')} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold text-sm">Manual Apply &rarr;</button> : <button onClick={submitApplication} className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold text-sm">Submit</button>}</div>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL MOCK STRIPE PAYMENT GATEWAY MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative text-center">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
            <div className="text-5xl mb-2">👑</div>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Unlock Job Dekho Premium</h2>
            <p className="text-xs text-slate-500 mb-6">Instant access to 1-Click Auto-Apply, ATS Scoring & AI Interview Kits.</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-left flex flex-col gap-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-600">Monthly Plan</span>
                <span className="font-black text-blue-600 text-lg">$9.00 <span className="text-xs text-slate-400 font-medium">/mo</span></span>
              </div>
              
              <div className="flex flex-col gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Card Number</label>
                  <input type="text" placeholder="4242 •••• •••• 4242" defaultValue="4242 4242 4242 4242" className="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-xs font-mono outline-none focus:border-blue-600" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expiration</label>
                    <input type="text" placeholder="MM/YY" defaultValue="12/28" className="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-xs font-mono outline-none focus:border-blue-600" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CVC / CVV</label>
                    <input type="password" placeholder="123" defaultValue="888" className="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-xs font-mono outline-none focus:border-blue-600" />
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handlePaymentSubmit} 
              disabled={processingPayment}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {processingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing Secure Payment...</span>
                </>
              ) : (
                "Authorize $9.00 Payment 🚀"
              )}
            </button>
            <p className="text-[10px] text-slate-400 mt-4 flex items-center justify-center gap-1">
              <span>🔒</span> 256-bit SSL Encrypted • MockStripe Sandbox API
            </p>
          </div>
        </div>
      )}

      <AICareerCoach extractedResumeText={extractedResumeText} jobs={jobs} isGuest={user.isGuest} isPremium={profileData.is_premium} />
    </div>
  );
}

function CandidateAnalyticsView({ email, resumeText }: { email: string; resumeText: string }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/user/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resume_text: resumeText })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setAnalytics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [email, resumeText]);

  if (loading) return <div className="text-center py-20 text-slate-400 font-semibold animate-pulse">Analyzing career metrics...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <h2 className="text-2xl font-black text-slate-900">Career & Application Analytics</h2>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Applied</p>
          <p className="text-3xl font-black text-blue-600 mt-2">{analytics?.metrics.total_applied}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Shortlisted</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">{analytics?.metrics.shortlisted}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Under Review</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{analytics?.metrics.under_review}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Profile Views</p>
          <p className="text-3xl font-black text-indigo-600 mt-2">{analytics?.metrics.profile_views}</p>
        </div>
      </div>

      {/* AI Skill Gap Insights Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8 rounded-3xl shadow-lg flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💡</span>
          <div>
            <h3 className="text-xl font-black">AI Skill Gap & Market Insights</h3>
            <p className="text-xs text-indigo-200 mt-0.5">Based on your uploaded resume and current active job feeds</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-indigo-800/60">
          <div>
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Recommended Skills to Learn</h4>
            <div className="flex flex-wrap gap-2">
              {analytics?.insights.missing_skills.map((skill: string, i: number) => (
                <span key={i} className="bg-indigo-800/60 border border-indigo-700 text-indigo-200 text-xs font-bold px-3 py-1.5 rounded-xl">
                  + {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Recruiter Recommendation</h4>
            <p className="text-sm text-slate-200 leading-relaxed bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/40">
              {analytics?.insights.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}