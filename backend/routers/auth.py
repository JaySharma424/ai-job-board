import os
import random
import requests
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, BackgroundTasks
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from database import db, profiles_collection

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
otps_collection = db["otps"]

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class AuthPayload(BaseModel):
    email: EmailStr
    password: str

class VerifyPayload(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    newPassword: str

def send_email_via_api(to_email: str, subject: str, html_content: str):
    """Bypasses Render's blocked SMTP ports by using Resend's HTTPS API"""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("❌ RESEND_API_KEY missing in environment variables")
        return

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": "Job Dekho <onboarding@resend.dev>",
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            print("✅ Email sent successfully via HTTP API!")
        else:
            print(f"❌ Failed to send email: {response.text}")
    except Exception as e:
        print(f"❌ Network Error: {e}")

def send_otp_email(email: str, otp: str, is_reset: bool = False):
    action = "Password Reset" if is_reset else "Account Verification"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
        <h2 style="color: #2563eb;">Job Dekho {action}</h2>
        <p style="color: #475569;">Your 6-digit code is:</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 28px; font-weight: bold; letter-spacing: 6px;">
            {otp}
        </div>
        <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes.</p>
    </div>
    """
    send_email_via_api(email, f"Job Dekho - {action} Code", html)

@router.post("/send-otp")
async def send_candidate_otp(data: AuthPayload, background_tasks: BackgroundTasks):
    if profiles_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    otp = str(random.randint(100000, 999999))
    hashed_password = pwd_context.hash(data.password)
    
    otps_collection.update_one(
        {"email": data.email}, 
        {"$set": {"otp": otp, "password": hashed_password, "type": "candidate"}}, 
        upsert=True
    )
    background_tasks.add_task(send_otp_email, data.email, otp, False)
    return {"success": True, "message": "OTP sent."}

@router.post("/verify-otp")
async def verify_candidate_otp(data: VerifyPayload):
    record = otps_collection.find_one({"email": data.email, "otp": data.otp, "type": "candidate"})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")
    
    profile_payload = {
        "email": data.email,
        "password": record["password"],
        "role": "candidate",
        "name": "Add Your Name",
        "title": "Add Current Role",
        "location": "Add Location",
        "phone": "+91 Add Number",
        "skills": ["React", "Python", "Machine Learning"],
        "bio": "Add a brief summary of your professional background.",
        "is_premium": False
    }
    
    profiles_collection.insert_one(profile_payload)
    otps_collection.delete_one({"email": data.email, "type": "candidate"})
    return {"success": True, "message": "Registration complete!"}

@router.post("/login")
async def login_user(data: AuthPayload):
    user = profiles_collection.find_one({"email": data.email, "role": {"$ne": "employer"}})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
        
    stored_password = user.get("password", "")
    is_valid = False
    try:
        is_valid = pwd_context.verify(data.password, stored_password)
    except Exception:
        is_valid = (stored_password == data.password)
        
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    
    return {"success": True, "email": user["email"], "role": user.get("role", "candidate")}

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = profiles_collection.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")
    
    # Generate 6-digit OTP instead of a URL token
    otp = str(random.randint(100000, 999999))
    
    otps_collection.update_one(
        {"email": req.email},
        {"$set": {"otp": otp, "type": "password_reset"}},
        upsert=True
    )
    
    background_tasks.add_task(send_otp_email, req.email, otp, True)
    return {"success": True, "message": "Password reset OTP sent to your email!"}

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    record = otps_collection.find_one({"email": req.email, "otp": req.otp, "type": "password_reset"})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset OTP.")
        
    hashed_password = pwd_context.hash(req.newPassword)
    
    # Update password and delete OTP
    profiles_collection.update_one(
        {"email": req.email},
        {"$set": {"password": hashed_password}}
    )
    otps_collection.delete_many({"email": req.email, "type": "password_reset"})
    
    return {"success": True, "message": "Password successfully updated!"}