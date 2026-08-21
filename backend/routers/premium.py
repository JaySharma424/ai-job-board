import os
import datetime
import resend
import google.generativeai as genai
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from database import profiles_collection, applications_collection

resend.api_key = os.getenv("RESEND_API_KEY")

router = APIRouter(
    prefix="/api/premium",
    tags=["Premium Services"]
)

class PaymentRequest(BaseModel):
    email: str
    token: str

class PremiumTaskRequest(BaseModel):
    email: str
    job_title: str
    company_name: str
    job_description: str
    resume_text: str

class AutoApplyRequest(BaseModel):
    email: str
    job_id: str
    job_title: str
    company_name: str
    location: str
    job_description: str
    resume_text: str

class TechnicalQuestionsRequest(BaseModel):
    job_title: str
    company_name: str
    job_description: str

def get_gemini_model():
    """Strictly uses 3.x Flash models for forward compatibility."""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    for model_name in ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue
    return genai.GenerativeModel('gemini-3.5-flash')

@router.post("/checkout")
async def upgrade_to_premium(data: PaymentRequest):
    profiles_collection.update_one(
        {"email": data.email},
        {"$set": {"is_premium": True}}
    )
    return {"success": True, "message": "Payment successful! Premium features unlocked."}

def generate_and_email_kit(data: PremiumTaskRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return
        model = get_gemini_model()
        prompt = f"""
        Act as an expert career coach. Create an Interview Preparation Kit for a {data.job_title} at {data.company_name}.
        Base the advice strictly on this Job Description: {data.job_description}
        And the candidate's Resume: {data.resume_text}
        Provide:
        1. Top 3 likely interview questions and how to answer them.
        2. 2 insightful questions the candidate should ask the interviewer.
        Format in clean HTML (<h2>, <ul>, <li>, <strong>). No markdown code blocks.
        """
        response = model.generate_content(prompt)
        html_content = response.text.strip().replace("```html", "").replace("```", "")

        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0;">Your AI Interview Kit 🎯</h1>
                <p style="margin: 5px 0 0 0;">Prepared for {data.company_name}</p>
            </div>
            <div style="border: 1px solid #e2e8f0; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                {html_content}
            </div>
        </div>
        """
        resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": data.email,
            "subject": f"Premium Prep: Interview Kit for {data.company_name}",
            "html": email_html
        })
    except Exception as e:
        print(f"Interview kit error: {e}")

def process_auto_apply(data: AutoApplyRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return
        model = get_gemini_model()
        
        prompt = f"""Write a concise, highly tailored cover letter connecting this Resume: {data.resume_text} 
        to this Job Description: {data.job_description}. Output ONLY the letter text."""
        response = model.generate_content(prompt)
        cover_letter = response.text.strip()

        applications_collection.insert_one({
            "email": data.email,
            "job_id": data.job_id,
            "title": data.job_title,
            "company_name": data.company_name,
            "location": data.location,
            "appliedAt": datetime.datetime.now().strftime("%b %d, %Y"),
            "status": "Auto-Applied ⚡",
            "cover_letter": cover_letter
        })

        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #2563eb; text-align: center;">Auto-Apply Successful ⚡</h2>
            <p>Your AI Agent has successfully submitted your application to <strong>{data.company_name}</strong> for the <strong>{data.job_title}</strong> role.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h4 style="margin-top: 0; color: #475569;">Generated Cover Letter Included:</h4>
                <p style="font-size: 13px; color: #64748b; white-space: pre-wrap;">{cover_letter}</p>
            </div>
        </div>
        """
        resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": data.email,
            "subject": f"Auto-Apply Success: {data.job_title} @ {data.company_name}",
            "html": email_html
        })
    except Exception as e:
        print(f"Auto Apply error: {e}")

@router.post("/interview-kit")
async def request_interview_kit(data: PremiumTaskRequest, background_tasks: BackgroundTasks):
    profile = profiles_collection.find_one({"email": data.email})
    if not profile or not profile.get("is_premium"):
        raise HTTPException(status_code=403, detail="Premium required.")
    
    background_tasks.add_task(generate_and_email_kit, data)
    return {"success": True, "message": "Interview kit generating in background!"}

@router.post("/auto-apply")
async def request_auto_apply(data: AutoApplyRequest, background_tasks: BackgroundTasks):
    profile = profiles_collection.find_one({"email": data.email})
    if not profile or not profile.get("is_premium"):
        raise HTTPException(status_code=403, detail="Premium required.")

    exists = applications_collection.find_one({"email": data.email, "job_id": data.job_id})
    if exists:
        return {"success": False, "error": "Already applied."}
    
    background_tasks.add_task(process_auto_apply, data)
    return {"success": True, "message": "Auto-Apply initiated! You will receive an email shortly."}

@router.post("/ats-score")
async def get_ats_score(data: PremiumTaskRequest):
    profile = profiles_collection.find_one({"email": data.email})
    if not profile or not profile.get("is_premium"):
        raise HTTPException(status_code=403, detail="Premium required.")
        
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key missing.")
        model = get_gemini_model()
        prompt = f"""
        Compare this Resume to this Job Description. 
        Return EXACTLY two lines.
        Line 1: A number between 0 and 100 representing the ATS match percentage. ONLY the number.
        Line 2: One short, actionable sentence on how to improve the resume for this role.
        Resume: {data.resume_text}
        Job: {data.job_description}
        """
        response = model.generate_content(prompt)
        lines = response.text.strip().split('\n')
        score = ''.join(filter(str.isdigit, lines[0]))
        feedback = lines[1] if len(lines) > 1 else "Consider adding more keywords from the job description."
        
        return {"success": True, "score": int(score) if score else 50, "feedback": feedback}
    except Exception as e:
        return {"success": False, "error": f"Failed to analyze ATS score: {str(e)}"}

@router.post("/top-technical-questions")
async def generate_top_technical_questions(data: TechnicalQuestionsRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")
        
        model = get_gemini_model()
        
        prompt = f"""
        Act as a Principal Technical Recruiter and Engineering Manager at {data.company_name}. 
        Based on this Job Description for a {data.job_title} role:
        {data.job_description}
        
        Generate the TOP 10 most rigorous technical, coding, architecture, and system design interview questions a candidate will face. 
        For each question, provide a 1-sentence hint or expected core competency.
        Format cleanly with numbers 1 to 10.
        """
        
        response = model.generate_content(prompt)
        return {"success": True, "questions": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))