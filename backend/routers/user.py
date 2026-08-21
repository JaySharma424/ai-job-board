import os
import google.generativeai as genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from database import (
    profiles_collection, 
    applications_collection, 
    saved_jobs_collection,
    notifications_collection
)

router = APIRouter(prefix="/api/user", tags=["User Profile"])

class UserProfilePayload(BaseModel):
    email: EmailStr
    name: Optional[str] = "Add Your Name"
    title: Optional[str] = "Add Current Role"
    location: Optional[str] = "Add Location"
    phone: Optional[str] = "+91 Add Number"
    skills: List[str] = []
    bio: Optional[str] = ""
    resume_text: Optional[str] = None      
    resume_filename: Optional[str] = None  
    is_premium: Optional[bool] = False

class ApplicationPayload(BaseModel):
    email: EmailStr
    job_id: str
    title: str
    company_name: str
    location: str
    appliedAt: str
    status: str = "Under Review"

class SavedJobPayload(BaseModel):
    email: EmailStr
    job_id: str
    title: str
    company_name: str
    location: str

class SkillGapRequest(BaseModel):
    email: str
    resume_text: str

def get_gemini_model():
    """Strictly uses 3.x Flash models for forward compatibility."""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    for model_name in ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue
    return genai.GenerativeModel('gemini-3.5-flash')

@router.get("/profile")
async def get_user_profile(email: str):
    profile = profiles_collection.find_one({"email": email}, {"_id": 0})
    if not profile:
        profile = {
            "email": email,
            "name": "Add Your Name",
            "title": "Add Current Role",
            "location": "Add Location",
            "phone": "+91 Add Number",
            "skills": ["React", "Python", "Machine Learning"],
            "bio": "Add a brief summary of your professional background.",
            "resume_text": "",
            "resume_filename": "",
            "is_premium": False
        }
        profiles_collection.insert_one(profile)
    if "_id" in profile:
        profile["_id"] = str(profile["_id"])
    return {"success": True, "data": profile}

@router.post("/profile")
async def save_user_profile(data: UserProfilePayload):
    profiles_collection.update_one(
        {"email": data.email},
        {"$set": data.dict(exclude_none=False)}, 
        upsert=True
    )
    return {"success": True, "message": "Profile updated successfully."}

@router.get("/applications")
async def get_user_applications(email: str):
    apps = list(applications_collection.find({"email": email}, {"_id": 0}))
    return {"success": True, "data": apps}

@router.post("/applications")
async def create_application(data: ApplicationPayload):
    exists = applications_collection.find_one({"email": data.email, "job_id": data.job_id})
    if exists:
        return {"success": True, "message": "Already applied."}
    applications_collection.insert_one(data.dict())
    return {"success": True, "message": "Application recorded."}

@router.delete("/applications")
async def withdraw_application(email: str, job_id: str):
    applications_collection.delete_one({"email": email, "job_id": job_id})
    return {"success": True, "message": "Application withdrawn."}

@router.get("/saved")
async def get_saved_jobs(email: str):
    saved = list(saved_jobs_collection.find({"email": email}, {"_id": 0}))
    return {"success": True, "data": saved}

@router.post("/saved/toggle")
async def toggle_saved_job(data: SavedJobPayload):
    exists = saved_jobs_collection.find_one({"email": data.email, "job_id": data.job_id})
    if exists:
        saved_jobs_collection.delete_one({"email": data.email, "job_id": data.job_id})
        return {"success": True, "action": "removed"}
    else:
        saved_jobs_collection.insert_one(data.dict())
        return {"success": True, "action": "saved"}

@router.get("/notifications")
async def get_notifications(email: str):
    notifs = list(notifications_collection.find({"email": email}, {"_id": 0}).sort("_id", -1))
    unread_count = notifications_collection.count_documents({"email": email, "read": False})
    return {"success": True, "notifications": notifs, "unread_count": unread_count}

@router.post("/notifications/read")
async def mark_notifications_read(data: dict):
    email = data.get("email")
    notifications_collection.update_many({"email": email}, {"$set": {"read": True}})
    return {"success": True, "message": "All notifications marked as read."}

@router.post("/analytics")
async def get_candidate_analytics(data: SkillGapRequest):
    total_applied = applications_collection.count_documents({"email": data.email})
    shortlisted = applications_collection.count_documents({"email": data.email, "status": "Shortlisted 🎉"})
    under_review = applications_collection.count_documents({"email": data.email, "status": "Under Review"})

    missing_skills = ["Advanced Cloud Architecture", "System Design"]
    learning_recommendation = "Add more quantifiable metrics to your resume and learn distributed systems."

    if data.resume_text and len(data.resume_text) > 50:
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                model = get_gemini_model()
                prompt = f"""
                Analyze this candidate resume: {data.resume_text}
                Based on current tech industry demands for software and data roles, provide:
                1. A comma-separated list of 3 high-demand skills they are missing.
                2. One sentence of professional advice to improve their hireability.
                Format response as:
                SKILLS: Skill1, Skill2, Skill3
                ADVICE: Your advice sentence here.
                """
                response = model.generate_content(prompt)
                lines = response.text.strip().split('\n')
                for line in lines:
                    if line.startswith("SKILLS:"):
                        missing_skills = [s.strip() for s in line.replace("SKILLS:", "").split(",")]
                    elif line.startswith("ADVICE:"):
                        learning_recommendation = line.replace("ADVICE:", "").strip()
        except Exception as e:
            print("Analytics AI Error:", e)

    return {
        "success": True,
        "metrics": {"total_applied": total_applied, "shortlisted": shortlisted, "under_review": under_review, "profile_views": 14},
        "insights": {"missing_skills": missing_skills, "recommendation": learning_recommendation}
    }