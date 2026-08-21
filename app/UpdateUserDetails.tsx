'use client';

import { useState, useEffect } from 'react';

type ProfileData = {
  name: string;
  title: string;
  location: string;
  phone: string;
  skills: string[];
  bio: string;
  is_premium: boolean;
  resume_text?: string;
  resume_filename?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  initialData: ProfileData;
  onSuccess: (updatedData: ProfileData) => void;
};

export default function UpdateUserDetails({ isOpen, onClose, userEmail, initialData, onSuccess }: Props) {
  const [formData, setFormData] = useState<ProfileData>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if initialData changes while modal is closed
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { ...formData, email: userEmail };
      const res = await fetch('http://localhost:8000/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        onSuccess(formData); // Pass the updated data back to dashboard
        onClose();
      } else {
        alert(data.detail || 'Failed to update profile.');
      }
    } catch (err) {
      alert('Network error while saving profile details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-900">Update Basic Details</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">This information helps recruiters find you.</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 transition-colors font-bold"
          >
            &times;
          </button>
        </div>
        
        {/* Form Body */}
        <div className="p-8 overflow-y-auto flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. John Doe"
                className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all" 
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Job Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                placeholder="e.g. Software Engineer"
                className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
              <input 
                type="text" 
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                placeholder="e.g. Bengaluru, India"
                className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all" 
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <input 
                type="text" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                placeholder="e.g. +91 9876543210"
                className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all" 
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-[2rem]">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save Details ✓'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}