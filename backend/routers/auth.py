import os
import uuid
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
    resetToken: str
    newPassword: str

def send_email_via_gmail(to_email: str, subject: str, html_content: str):
    sender_email = os.getenv("GMAIL_USER")
    sender_password = os.getenv("GMAIL_APP_PASSWORD")

    if not sender_email or not sender_password:
        print("Gmail credentials missing in .env")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Job Dekho <{sender_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, sender_password.replace(" ", ""))
            server.sendmail(sender_email, to_email, msg.as_string())
    except Exception as e:
        print(f"SMTP Gmail Error: {e}")

def send_otp_email(email: str, otp: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
        <h2 style="color: #2563eb;">Verify your Job Dekho Account</h2>
        <p style="color: #475569;">Your 6-digit verification code is:</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 28px; font-weight: bold; letter-spacing: 6px;">
            {otp}
        </div>
        <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes.</p>
    </div>
    """
    send_email_via_gmail(email, "Job Dekho Verification Code", html)

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
    background_tasks.add_task(send_otp_email, data.email, otp)
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
    otps_collection.delete_one({"email": data.email})
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
    
    reset_token = uuid.uuid4().hex
    expiry_time = datetime.utcnow() + timedelta(hours=1)
    
    profiles_collection.update_one(
        {"email": req.email},
        {"$set": {"resetToken": reset_token, "resetTokenExpiry": expiry_time}}
    )
    
    reset_url = f"http://localhost:3000?resetToken={reset_token}&email={req.email}"
    
    html = f"""
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #333;">
            <h2 style="color: #2563eb;">Password Reset Assistance</h2>
            <p>Click the secure button below to proceed with setting your new password:</p>
            <a href="{reset_url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Your Password</a>
        </div>
    """
    background_tasks.add_task(send_email_via_gmail, req.email, "Password Reset Request - Job Dekho", html)
    return {"success": True, "message": "Password reset email successfully sent!"}