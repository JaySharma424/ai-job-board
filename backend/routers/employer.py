import os
import json
import random
import smtplib
import uuid
import re
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

# Ensure database and vector DB are imported!
from database import db, jobs_collection, profiles_collection, applications_collection
from vector_db import qdrant_client, COLLECTION_NAME, generate_embedding
from qdrant_client.http import models

otps_collection = db["otps"]

# --- ABSOLUTE PATH FIX ---
# Ensures Python always finds and updates your main JSON file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DB_PATH = os.path.join(BASE_DIR, "jobs_data.json")

router = APIRouter(
    prefix="/api/employer",
    tags=["Employer & Recruiter Portal"]
)

# --- SCHEMAS ---
class EmployerRegisterPayload(BaseModel):
    email: EmailStr
    password: str
    company_name: str
    employer_name: str
    gst_number: str
    industry: str
    phone: str
    location: str
    website: Optional[str] = ""

class EmployerLoginPayload(BaseModel):
    email: EmailStr
    password: str

class VerifyPayload(BaseModel):
    email: EmailStr
    otp: str

class JobPostRequest(BaseModel):
    title: str
    company_name: str
    description: str
    email: Optional[str] = "recruiter@company.com"
    location: Optional[str] = "Remote"
    experience: Optional[str] = ""
    experience_level: Optional[str] = ""
    minExperienceRequired: Optional[str] = ""
    skills: Optional[str] = ""
    ai_tags: Optional[Dict[str, Any]] = {}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

# --- NLP / TEXT NORMALIZATION HELPER ---
def fast_clean_description(text: str) -> str:
    """Uses lightning-fast Regex to fix clumping and format bullet points"""
    if not text or not isinstance(text, str):
        return ""
    
    # Un-clump Headers
    common_headers = [
        "Required Skills", "Key Responsibilities", "Qualifications", 
        "Job Description", "Role Description", "About Us", "Requirements",
        "Company Description", "Role", "Responsibilities", "Must Have"
    ]
    for header in common_headers:
        text = re.sub(rf'({header})([A-Z])', r'\1:\n\n\2', text, flags=re.IGNORECASE)

    # General Boundary Un-clumping
    text = re.sub(r'([a-z0-9\.])([A-Z][a-z]+)', r'\1\n\2', text)

    # Clean up weird bullet point spacing
    text = re.sub(r'([^\n])(\s*[-•*]\s+[A-Z])', r'\1\n\n\2', text)
    
    return text.strip()

# --- VECTOR TEXT BUILDER HELPER ---
def build_job_text(job: dict) -> str:
    """Extracts all rich data to generate an incredibly accurate AI vector"""
    skills_str = job.get("skills", "")
    exp_str = job.get("minExperienceRequired", "Not Specified")
    location = job.get("location", "Remote")
    desc = str(job.get("description", ""))[:300].replace("\n", " ")
    
    return f"""
    Title: {job.get('title', '')}
    Company: {job.get('company_name', '')}
    Location: {location}
    Experience: {exp_str}
    Skills: {skills_str}
    Description: {desc}
    """.strip()

# --- FREE GMAIL SENDER UTILITY ---
def send_email_via_gmail(to_email: str, subject: str, html_content: str):
    sender_email = os.getenv("GMAIL_USER")
    sender_password = os.getenv("GMAIL_APP_PASSWORD")
    if not sender_email or not sender_password:
        print("❌ [SMTP ERROR] GMAIL_USER or GMAIL_APP_PASSWORD missing in backend/.env")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"AI Naukri Recruiter <{sender_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, sender_password.replace(" ", ""))
            server.sendmail(sender_email, to_email, msg.as_string())
    except Exception as e:
        print(f"❌ [SMTP ERROR] Failed to send email via Gmail SSL: {e}")

def send_employer_otp_email(email: str, otp: str, is_login: bool = False):
    action_text = "Login Verification" if is_login else "Account Registration"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
        <h2 style="color: #f59e0b;">AI Naukri Recruiter Suite</h2>
        <p style="color: #475569;">Your 6-digit corporate {action_text} code is:</p>
        <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #b45309;">
            {otp}
        </div>
        <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes.</p>
    </div>
    """
    send_email_via_gmail(email, f"AI Naukri Recruiter OTP - {action_text}", html)

# ----------------------------------------------------
# ENDPOINTS
# ----------------------------------------------------
@router.post("/login")
async def login_employer(data: EmployerLoginPayload, background_tasks: BackgroundTasks):
    user = profiles_collection.find_one({"email": data.email, "role": "employer"})
    if not user or user.get("password") != data.password:
        raise HTTPException(status_code=400, detail="Invalid corporate email or password.")
    otp = str(random.randint(100000, 999999))
    otps_collection.update_one({"email": data.email}, {"$set": {"otp": otp, "type": "employer_login"}}, upsert=True)
    background_tasks.add_task(send_employer_otp_email, data.email, otp, True)
    return {"success": True, "requires_otp": True, "message": "Login OTP sent."}

@router.post("/send-otp")
async def send_employer_otp(data: EmployerRegisterPayload, background_tasks: BackgroundTasks):
    if profiles_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Corporate email already registered.")
    otp = str(random.randint(100000, 999999))
    otps_collection.update_one({"email": data.email}, {"$set": {"otp": otp, "payload": data.dict(), "type": "employer_register"}}, upsert=True)
    background_tasks.add_task(send_employer_otp_email, data.email, otp, False)
    return {"success": True, "message": "Registration OTP sent."}

@router.post("/verify-otp")
async def verify_employer_otp(data: VerifyPayload):
    record = otps_collection.find_one({"email": data.email, "otp": data.otp})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired corporate OTP.")
    otp_type = record.get("type")
    if otp_type == "employer_register":
        payload = record["payload"]
        payload["role"] = "employer"
        profiles_collection.insert_one(payload)
    otps_collection.delete_one({"email": data.email})
    return {"success": True, "message": "Verification complete!"}

@router.get("/profile")
async def get_employer_profile(email: str):
    profile = profiles_collection.find_one({"email": email, "role": "employer"}, {"_id": 0})
    return {"success": True, "data": profile or {}}

@router.post("/profile")
async def save_employer_profile(data: dict):
    email = data.get("email")
    profiles_collection.update_one({"email": email}, {"$set": data}, upsert=True)
    return {"success": True, "message": "Company profile saved successfully."}

@router.post("/forgot-password")
async def recruiter_forgot_password(data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    reset_code = "".join(random.choices("0123456789", k=6))
    html = f"<div style='font-family: Arial, sans-serif; text-align: center;'><h2 style='color: #2563eb;'>Recruiter Password Reset</h2><div style='background-color: #f8fafc; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold;'>{reset_code}</div></div>"
    background_tasks.add_task(send_email_via_gmail, data.email, "Recruiter Password Reset Code", html)
    return {"success": True, "message": f"Instructions sent to {data.email}."}

# ----------------------------------------------------
# POST JOB: FORMAT + MONGODB + QDRANT + JSON BACKUP
# ----------------------------------------------------
@router.post("/jobs")
async def post_employer_job(data: JobPostRequest):
    try:
        unique_job_id = str(uuid.uuid4())
        exp = data.minExperienceRequired or data.experience_level or data.experience or "Not Specified"
        
        ai_tags = data.ai_tags or {}
        if data.skills and "skills" not in ai_tags:
            ai_tags["skills"] = [s.strip() for s in data.skills.split(",") if s.strip()]

        # 1. PRE-PROCESS: NLP Formatting
        formatted_desc = fast_clean_description(data.description)

        job_doc = {
            "job_id": unique_job_id,
            "title": data.title,
            "company_name": data.company_name,
            "location": data.location or "Remote",
            "minExperienceRequired": exp,
            "description": data.description,               # Raw for LLM later
            "formattedDescription": formatted_desc,        # Clean for UI
            "skills": data.skills,
            "via": "Direct Employer",
            "ai_tags": ai_tags,
            "employer_email": str(data.email),
            "posted_date": datetime.utcnow().isoformat()
        }

        # 2. DATABASE: Save to MongoDB
        result = jobs_collection.insert_one(job_doc.copy())
        mongo_id = str(result.inserted_id)
        job_doc["_id"] = mongo_id
        print("✅ Succesfully Updated the Database...")

        # 3. VECTOR DB: Embed and Push to Qdrant Cloud
        if qdrant_client:
            print(f"🧠 Generating embedding for new job: {data.title}...")
            vector_text = build_job_text(job_doc)
            vector = generate_embedding(vector_text)
            
            if vector:
                print("🚀 Uploading new job vector to Qdrant Cloud...")
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, mongo_id))
                qdrant_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[
                        models.PointStruct(
                            id=point_id,
                            vector=vector,
                            payload={
                                "mongodb_id": mongo_id,
                                "job_id": unique_job_id,
                                "title": data.title,
                                "company_name": data.company_name
                            }
                        )
                    ],
                    wait=False # Don't block the API response
                )
            print("✅ Vector stored in Qdrant Cloud.")

        # 4. JSON BACKUP: Append to local file
        try:
            jobs_list = []
            if os.path.exists(JSON_DB_PATH):
                with open(JSON_DB_PATH, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        parsed = json.loads(content)
                        if isinstance(parsed, list): jobs_list = parsed
                        elif isinstance(parsed, dict) and "jobs" in parsed: jobs_list = parsed["jobs"]
                        else: jobs_list = [parsed]
            
            jobs_list.append(job_doc)
            with open(JSON_DB_PATH, "w", encoding="utf-8") as f:
                json.dump(jobs_list, f, indent=4)
        except Exception as json_err:
            print(f"⚠️ Warning: Failed to save to local JSON file: {json_err}")

        return {"success": True, "job_id": unique_job_id, "message": "Job successfully published and indexed by AI!"}
    except Exception as e:
        print(f"Error posting job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error posting job: {str(e)}")

# ----------------------------------------------------
# REAL-TIME DASHBOARD ANALYTICS
# ----------------------------------------------------
@router.get("/analytics")
async def get_employer_analytics(email: str):
    try:
        profile = profiles_collection.find_one({"email": email, "role": "employer"})
        gst = profile.get("gst_number", "N/A") if profile else "N/A"

        employer_jobs = list(jobs_collection.find({"employer_email": email}))
        active_postings = len(employer_jobs)

        job_ids = [str(j["_id"]) for j in employer_jobs] 
        job_ids.extend([j.get("job_id") for j in employer_jobs if "job_id" in j])
        
        if job_ids:
            total_apps = applications_collection.count_documents({"job_id": {"$in": job_ids}})
            shortlisted = applications_collection.count_documents({"job_id": {"$in": job_ids}, "status": {"$regex": "Shortlisted", "$options": "i"}})
        else:
            total_apps, shortlisted = 0, 0

        return {
            "success": True,
            "metrics": {
                "active_postings": active_postings,
                "total_applications": total_apps,
                "shortlisted": shortlisted,
                "company_gst": gst
            }
        }
    except Exception as e:
        return {"success": False, "metrics": {"active_postings": 0, "total_applications": 0, "shortlisted": 0, "company_gst": "Error"}}