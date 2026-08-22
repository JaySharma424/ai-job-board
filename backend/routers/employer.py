import os
import json
import random
import uuid
import re
import requests
import google.generativeai as genai
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from database import db, jobs_collection, profiles_collection, applications_collection
from vector_db import qdrant_client, COLLECTION_NAME, generate_embedding
from qdrant_client.http import models

otps_collection = db["otps"]

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

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    newPassword: str

# --- UTILITIES ---
def fast_clean_description(text: str) -> str:
    """Basic fallback cleaner if AI fails"""
    if not text or not isinstance(text, str): return ""
    common_headers = ["Required Skills", "Key Responsibilities", "Qualifications", "Job Description", "Role Description", "About Us", "Requirements", "Company Description", "Role", "Responsibilities", "Must Have"]
    for header in common_headers: text = re.sub(rf'({header})([A-Z])', r'\1:\n\n\2', text, flags=re.IGNORECASE)
    text = re.sub(r'([a-z0-9\.])([A-Z][a-z]+)', r'\1\n\2', text)
    text = re.sub(r'([^\n])(\s*[-•*]\s+[A-Z])', r'\1\n\n\2', text)
    return text.strip()

def build_job_text(job: dict) -> str:
    skills_str = job.get("skills", "")
    exp_str = job.get("minExperienceRequired", "Not Specified")
    location = job.get("location", "Remote")
    desc = str(job.get("description", ""))[:300].replace("\n", " ")
    return f"Title: {job.get('title', '')}\nCompany: {job.get('company_name', '')}\nLocation: {location}\nExperience: {exp_str}\nSkills: {skills_str}\nDescription: {desc}".strip()

def extract_tags_via_llm(description: str) -> dict:
    """Uses Gemini to extract structured tags AND perfectly format the description."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: return {}
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3.5-flash')
        
        prompt = f"""
        You are an expert HR data extraction and job-description normalization engine.
        Your task is to analyze the provided raw job description (JD) and transform it into a
        clean, structured, machine-readable representation suitable for a production HR/job
        search dataset.

        IMPORTANT:
        - Extract information ONLY from the provided job description.
        - Do NOT invent, assume, or hallucinate skills, qualifications, responsibilities,
        experience levels, companies, technologies, or requirements that are not supported
        by the JD.
        - Normalize equivalent terms where appropriate (e.g., "Python programming" → "Python",
          "Machine Learning" → "Machine Learning", "MS Excel" → "Excel").
        - Remove duplicate skills.
        - Preserve the meaning of the original JD.
        - If information is unavailable or cannot be confidently inferred, use a reasonable
          fallback such as "Not Specified" rather than fabricating information.

        RAW JOB DESCRIPTION:
        --------------------
        {desc}
        --------------------

        ## 1. EXTRACTED SKILLS

        Extract the important technical and professional skills explicitly mentioned or
        strongly required in the JD.

        Include, when applicable:
        - Programming languages
        - Frameworks and libraries
        - Databases
        - Cloud platforms
        - DevOps / deployment technologies
        - Data Science / Machine Learning / AI technologies
        - Software engineering technologies
        - Tools and platforms
        - Domain-specific technical skills
        - Soft skills explicitly required by the employer

        Rules:
        - Return unique skills only.
        - Prefer canonical/common skill names.
        - Do not extract generic words such as "computer", "technology", "work", or "team"
          unless they represent an actual requirement.
        - Do not infer technologies merely because they are commonly associated with the role.
        - Keep the list concise and relevant to the job.

        ## 2. JOB CATEGORY

        Determine the primary job category based on the actual responsibilities and
        requirements in the JD.

        Examples:
        - Software Engineering
        - Data Science
        - Data Analytics
        - Machine Learning / AI
        - Generative AI
        - Backend Development
        - Frontend Development
        - Full Stack Development
        - DevOps / Cloud
        - Cybersecurity
        - Product Management
        - UI/UX Design
        - Business / Management
        - Marketing
        - Finance
        - Human Resources
        - Research
        - Other

        If multiple areas are mentioned, select the category that best represents the
        PRIMARY responsibility of the position.

        Do not classify the job solely based on isolated skills.

        ## 3. EXPERIENCE LEVEL

        Infer the seniority level using explicit experience requirements, job title,
        responsibilities, and seniority indicators.

        Allowed values:
        - "Internship"
        - "Entry Level"
        - "Junior"
        - "Mid Level"
        - "Senior"
        - "Lead / Principal"
        - "Manager"
        - "Not Specified"

        Guidelines:
        - 0–1 years or fresh graduate → usually "Entry Level"
        - 1–3 years → usually "Junior"
        - 3–6 years → usually "Mid Level"
        - 6+ years → usually "Senior"
        - Lead, Principal, Staff → "Lead / Principal"
        - Manager / people-management responsibility → "Manager"

        These ranges are guidelines only. Prefer explicit wording in the JD over
        years-of-experience ranges.

        If the JD does not provide enough evidence, return "Not Specified".

        ## 4. FORMATTED DESCRIPTION

        Rewrite the raw JD into clean, professional Markdown while preserving the original
        meaning and factual information.

        Formatting requirements:

        - Use Markdown section headers in bold.
        - Use bullet points with "-".
        - Separate major sections with blank lines.
        - Make the content easy to scan.
        - Correct obvious formatting, spacing, and OCR/text extraction issues.
        - Remove unnecessary repeated whitespace.
        - Preserve important details such as qualifications, responsibilities,
          experience requirements, location, employment type, and other job-specific
          information when present.
        - Do NOT add information that does not exist in the original JD.
        - Do NOT change the meaning of responsibilities or requirements.
        - Do NOT add promotional language.
        - Do NOT use HTML.
        - Do NOT use Markdown tables.
        - Do NOT use emojis.

        Preferred structure when the information exists:

        **About the Role:**
        <short paragraph>

        **Responsibilities:**
        - Responsibility 1
        - Responsibility 2

        **Requirements:**
        - Requirement 1
        - Requirement 2

        **Technical Skills:**
        - Skill 1
        - Skill 2

        **Preferred Qualifications:**
        - Qualification 1

        **Additional Information:**
        - Location, employment type, salary, benefits, etc. when explicitly available.

        Only include sections that are supported by the original JD.

        ## 5. DATA QUALITY RULES

        Before returning the result, verify that:

        1. The JSON is syntactically valid.
        2. No duplicate skills exist.
        3. Skills are normalized consistently.
        4. The job category matches the primary nature of the role.
        5. Experience level is supported by evidence from the JD.
        6. No unsupported information has been added.
        7. formatted_description contains valid Markdown.
        8. All required fields are present.
        9. Do not include explanations outside the JSON.
        10. Return ONLY the JSON object.

        ## REQUIRED JSON SCHEMA

        {{
            "extracted_skills": [
                "skill1",
                "skill2",
                "skill3"
            ],
            "job_category": "Primary Job Category",
            "inferred_experience": "Entry Level / Junior / Mid Level / Senior / etc.",
            "formatted_description": "Formatted Markdown job description"
        }}

        Return ONLY the JSON object.
        """
        
        response = model.generate_content(prompt)
        text_response = response.text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(text_response)
    except Exception as e:
        print(f"⚠️ AI Tag Extraction Failed: {e}")
        return {}

def send_email_via_api(to_email: str, subject: str, html_content: str):
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key: return
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {"accept": "application/json", "api-key": api_key, "content-type": "application/json"}
    payload = {"sender": {"name": "Job Dekho Recruiter", "email": "dhananjayraj8210@gmail.com"}, "to": [{"email": to_email}], "subject": subject, "htmlContent": html_content}
    try: requests.post(url, headers=headers, json=payload)
    except: pass

def send_employer_otp_email(email: str, otp: str, is_login: bool = False, is_reset: bool = False):
    action_text = "Password Reset" if is_reset else ("Login Verification" if is_login else "Account Registration")
    html = f"""<div style="font-family: Arial, sans-serif; text-align: center;"><h2 style="color: #f59e0b;">Job Dekho Recruiter Suite</h2><div style="background-color: #fffbeb; padding: 20px; font-size: 32px; font-weight: bold;">{otp}</div></div>"""
    send_email_via_api(email, f"Job Dekho Recruiter OTP - {action_text}", html)

# --- AUTH ENDPOINTS ---
@router.post("/login")
async def login_employer(data: EmployerLoginPayload, background_tasks: BackgroundTasks):
    user = profiles_collection.find_one({"email": data.email, "role": "employer"})
    if not user or user.get("password") != data.password: raise HTTPException(status_code=400, detail="Invalid corporate email or password.")
    otp = str(random.randint(100000, 999999))
    otps_collection.update_one({"email": data.email}, {"$set": {"otp": otp, "type": "employer_login"}}, upsert=True)
    background_tasks.add_task(send_employer_otp_email, data.email, otp, True, False)
    return {"success": True, "requires_otp": True, "message": "Login OTP sent."}

@router.post("/send-otp")
async def send_employer_otp(data: EmployerRegisterPayload, background_tasks: BackgroundTasks):
    if profiles_collection.find_one({"email": data.email}): raise HTTPException(status_code=400, detail="Corporate email already registered.")
    otp = str(random.randint(100000, 999999))
    otps_collection.update_one({"email": data.email}, {"$set": {"otp": otp, "payload": data.dict(), "type": "employer_register"}}, upsert=True)
    background_tasks.add_task(send_employer_otp_email, data.email, otp, False, False)
    return {"success": True, "message": "Registration OTP sent."}

@router.post("/verify-otp")
async def verify_employer_otp(data: VerifyPayload):
    record = otps_collection.find_one({"email": data.email, "otp": data.otp})
    if not record: raise HTTPException(status_code=400, detail="Invalid or expired corporate OTP.")
    if record.get("type") == "employer_register": profiles_collection.insert_one({**record["payload"], "role": "employer"})
    otps_collection.delete_one({"email": data.email})
    return {"success": True, "message": "Verification complete!"}

@router.get("/profile")
async def get_employer_profile(email: str):
    return {"success": True, "data": profiles_collection.find_one({"email": email, "role": "employer"}, {"_id": 0}) or {}}

@router.post("/profile")
async def save_employer_profile(data: dict):
    profiles_collection.update_one({"email": data.get("email")}, {"$set": data}, upsert=True)
    return {"success": True, "message": "Company profile saved successfully."}

@router.post("/forgot-password")
async def recruiter_forgot_password(data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    if not profiles_collection.find_one({"email": data.email, "role": "employer"}): raise HTTPException(status_code=404, detail="No employer account found.")
    otp = str(random.randint(100000, 999999))
    otps_collection.update_one({"email": data.email}, {"$set": {"otp": otp, "type": "employer_password_reset"}}, upsert=True)
    background_tasks.add_task(send_employer_otp_email, data.email, otp, False, True)
    return {"success": True, "message": "Password reset OTP sent!"}

@router.post("/reset-password")
async def reset_employer_password(req: ResetPasswordRequest):
    if not otps_collection.find_one({"email": req.email, "otp": req.otp, "type": "employer_password_reset"}): raise HTTPException(status_code=400, detail="Invalid or expired reset OTP.")
    profiles_collection.update_one({"email": req.email, "role": "employer"}, {"$set": {"password": req.newPassword}})
    otps_collection.delete_many({"email": req.email, "type": "employer_password_reset"})
    return {"success": True, "message": "Password successfully updated!"}

# --- JOB POSTING ---
@router.post("/jobs")
async def post_employer_job(data: JobPostRequest):
    try:
        unique_job_id = str(uuid.uuid4())
        exp = data.minExperienceRequired or data.experience_level or data.experience or "Not Specified"
        formatted_desc = fast_clean_description(data.description)
        
        print("🧠 Running AI Data Preprocessing Pipeline...")
        ai_extracted_data = extract_tags_via_llm(data.description)
        
        merged_skills = data.skills
        if ai_extracted_data.get("extracted_skills"):
            user_skills = [s.strip() for s in (data.skills or "").split(",") if s.strip()]
            merged_skills = ", ".join(list(set(user_skills + ai_extracted_data["extracted_skills"])))
            
        if exp == "Not Specified" and ai_extracted_data.get("inferred_experience"):
            exp = ai_extracted_data["inferred_experience"]
            
        job_category = ai_extracted_data.get("job_category", "General")
        
        # 🟢 THE FIX: Apply beautifully formatted Markdown text from Gemini
        if ai_extracted_data.get("formatted_description"):
            formatted_desc = ai_extracted_data["formatted_description"]

        job_doc = {
            "job_id": unique_job_id,
            "title": data.title,
            "company_name": data.company_name,
            "location": data.location or "Remote",
            "minExperienceRequired": exp,
            "category": job_category,
            "description": data.description,               
            "formattedDescription": formatted_desc,  # This now contains **bold** and bullets!      
            "skills": merged_skills,
            "via": "Direct Employer",
            "ai_tags": ai_extracted_data,
            "employer_email": str(data.email),
            "posted_date": datetime.utcnow().isoformat(),
            "ai_processed": True 
        }

        result = jobs_collection.insert_one(job_doc.copy())
        mongo_id = str(result.inserted_id)
        job_doc["_id"] = mongo_id

        if qdrant_client:
            vector = generate_embedding(build_job_text(job_doc))
            if vector:
                qdrant_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[models.PointStruct(id=str(uuid.uuid5(uuid.NAMESPACE_DNS, mongo_id)), vector=vector, payload={"mongodb_id": mongo_id, "job_id": unique_job_id, "title": data.title, "company_name": data.company_name, "category": job_category})],
                    wait=False 
                )

        try:
            jobs_list = []
            if os.path.exists(JSON_DB_PATH):
                with open(JSON_DB_PATH, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content: jobs_list = json.loads(content)
            if isinstance(jobs_list, dict) and "jobs" in jobs_list: jobs_list = jobs_list["jobs"]
            elif not isinstance(jobs_list, list): jobs_list = [jobs_list] if jobs_list else []
            
            jobs_list.append(job_doc)
            with open(JSON_DB_PATH, "w", encoding="utf-8") as f: json.dump(jobs_list, f, indent=4)
        except: pass

        return {"success": True, "job_id": unique_job_id, "message": "Job published and perfectly formatted by AI!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BATCH AI ETL PIPELINE ---
@router.post("/run-daily-etl")
async def run_daily_etl(authorization: Optional[str] = Header(None)):
    if authorization != f"Bearer {os.getenv('CRON_SECRET', 'secret123')}": raise HTTPException(status_code=401, detail="Unauthorized.")
    unprocessed_jobs = list(jobs_collection.find({"ai_processed": False}).limit(20))
    if not unprocessed_jobs: return {"success": True, "message": "No new jobs to process today!"}

    batch_payload = [{"job_id": job["job_id"], "description": str(job.get("description", ""))[:1200]} for job in unprocessed_jobs]

    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: raise Exception("No API Key")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3.5-flash')
        
        prompt = f"""
        You are an expert HR data parser processing a batch of jobs. Extract tags AND format the description for each job.
        - Use **bold** text for section headers (e.g., **Responsibilities:**).
        - Use standard bullet points (-) for lists.
        
        Example Output Format:
        {{
            "job123": {{
                "extracted_skills": ["Python", "SQL"], 
                "job_category": "Data", 
                "inferred_experience": "Mid Level",
                "formatted_description": "**Role Overview:**\\nWe are looking for...\\n\\n**Key Skills:**\\n- Python\\n- SQL"
            }}
        }}
        
        Jobs to process:
        {json.dumps(batch_payload)}
        """
        
        response = model.generate_content(prompt)
        extracted_data = json.loads(response.text.strip().removeprefix("```json").removesuffix("```").strip())

        processed_count = 0
        for job in unprocessed_jobs:
            jid = job["job_id"]
            if jid in extracted_data:
                ai_data = extracted_data[jid]
                
                update_fields = {
                    "skills": ", ".join(list(set([s.strip() for s in (job.get("skills", "")).split(",") if s.strip()] + ai_data.get("extracted_skills", [])))),
                    "category": ai_data.get("job_category", job.get("category", "General")),
                    "ai_tags": ai_data,
                    "ai_processed": True
                }
                if ai_data.get("formatted_description"): update_fields["formattedDescription"] = ai_data["formatted_description"]
                if job.get("minExperienceRequired", "Not Specified") == "Not Specified" and ai_data.get("inferred_experience"): update_fields["minExperienceRequired"] = ai_data["inferred_experience"]

                jobs_collection.update_one({"_id": job["_id"]}, {"$set": update_fields})
                job.update(update_fields) 

                if qdrant_client:
                    vector = generate_embedding(build_job_text(job))
                    if vector: qdrant_client.upsert(collection_name=COLLECTION_NAME, points=[models.PointStruct(id=str(uuid.uuid5(uuid.NAMESPACE_DNS, str(job["_id"]))), vector=vector, payload={"mongodb_id": str(job["_id"]), "job_id": jid, "title": job["title"], "company_name": job["company_name"], "category": update_fields["category"]})])
                processed_count += 1
                
        return {"success": True, "message": f"ETL Pipeline Complete. Processed {processed_count} jobs using 1 LLM call!", "processed": processed_count}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/analytics")
async def get_employer_analytics(email: str):
    try:
        profile = profiles_collection.find_one({"email": email, "role": "employer"})
        gst = profile.get("gst_number", "N/A") if profile else "N/A"

        employer_jobs = list(jobs_collection.find({"employer_email": email}))
        active_postings = len(employer_jobs)
        job_ids = [str(j["_id"]) for j in employer_jobs] + [j.get("job_id") for j in employer_jobs if "job_id" in j]
        
        if job_ids:
            total_apps = applications_collection.count_documents({"job_id": {"$in": job_ids}})
            shortlisted = applications_collection.count_documents({"job_id": {"$in": job_ids}, "status": {"$regex": "Shortlisted", "$options": "i"}})
        else: total_apps, shortlisted = 0, 0

        return {"success": True, "metrics": {"active_postings": active_postings, "total_applications": total_apps, "shortlisted": shortlisted, "company_gst": gst}}
    except:
        return {"success": False, "metrics": {"active_postings": 0, "total_applications": 0, "shortlisted": 0, "company_gst": "Error"}}