import os
import json
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pypdf import PdfReader
import google.generativeai as genai
from bson import ObjectId
from database import jobs_collection, db
from pydantic import BaseModel
from vector_db import qdrant_client, COLLECTION_NAME, generate_embedding

router = APIRouter(prefix="/api/resume", tags=["Resume Analysis"])

users_collection = db["users"] if db is not None else None


def serialize_job(job):
    if job and "_id" in job:
        job["_id"] = str(job["_id"])
    return job


def get_active_gemini_model():
    """Configures and returns the active Gemini flash model."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is missing in your .env file.")
    genai.configure(api_key=api_key)
    
    for model_name in ['gemini-3.5-flash', 'gemini-3.6-flash']:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue
    return genai.GenerativeModel('gemini-3.5-flash')


@router.post("")
async def analyze_resume(
    resume: UploadFile = File(...),
    email: Optional[str] = Form(None),
    is_premium: Optional[bool] = Form(None)
):
    try:
        # 1. Determine Tier: 10 jobs for Pro/Premium, 2 jobs for Normal users
        user_is_pro = False
        if is_premium is not None:
            user_is_pro = is_premium
        elif email and users_collection is not None:
            user = users_collection.find_one({"email": email})
            if user:
                user_is_pro = user.get("is_pro", user.get("is_premium", False))

        target_limit = 10 if user_is_pro else 2
        print(f"👤 Candidate: {email or 'Anonymous'} | Pro Status: {user_is_pro} | Target Retrieval Limit: {target_limit}")

        # 2. Extract Text from Resume PDF
        resume_text = ""
        try:
            pdf_reader = PdfReader(resume.file)
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    resume_text += extracted + "\n"
        except Exception as pdf_err:
            print(f"⚠️ PDF parsing warning: {pdf_err}")

        if not resume_text.strip():
            resume_text = f"Candidate profile uploaded from file: {resume.filename}"

        # 3. Vector Retrieval from Qdrant Cloud
        available_jobs = []
        try:
            if qdrant_client:
                print(f"🔍 Generating vector & querying Qdrant Cloud (Limit: {target_limit})...")
                resume_vector = generate_embedding(resume_text[:2500], is_query=True)
                
                if resume_vector:
                    search_results = []
                    try:
                        response = qdrant_client.query_points(
                            collection_name=COLLECTION_NAME,
                            query=resume_vector,
                            limit=target_limit
                        )
                        search_results = response.points
                    except AttributeError:
                        search_results = qdrant_client.search(
                            collection_name=COLLECTION_NAME,
                            query_vector=resume_vector,
                            limit=target_limit
                        )

                    # Extract MongoDB IDs stored in vector payload
                    retrieved_ids = []
                    for hit in search_results:
                        payload = getattr(hit, "payload", {}) or {}
                        mongo_id = payload.get("mongodb_id") or str(hit.id)
                        retrieved_ids.append(mongo_id)

                    valid_object_ids = [ObjectId(jid) for jid in retrieved_ids if ObjectId.is_valid(jid)]
                    query_filter = {
                        "$or": [
                            {"_id": {"$in": valid_object_ids}},
                            {"job_id": {"$in": retrieved_ids}}
                        ]
                    }
                    cursor = jobs_collection.find(query_filter)
                    available_jobs = [serialize_job(doc) for doc in cursor]
                    print(f"✅ Retrieved {len(available_jobs)} matches from Qdrant Cloud!")
        except Exception as qdrant_err:
            print(f"⚠️ Qdrant search error: {qdrant_err}. Using database fallback.")

        # Fallback to direct DB query if Qdrant is unavailable
        if not available_jobs:
            print("⚡ Using direct database fallback.")
            cursor = jobs_collection.find().limit(target_limit)
            available_jobs = [serialize_job(doc) for doc in cursor]

        if not available_jobs:
            raise HTTPException(status_code=404, detail="No job listings found in database.")

        # 4. LLM Redesign, Reasoning & Normalization
        simplified_jobs = []
        for j in available_jobs:
            skills = j.get("skills") if j.get("skills") and j.get("skills") != "Not mentioned" else j.get("ai_tags", {}).get("skills", [])
            simplified_jobs.append({
                "job_id": j["_id"],
                "title": j.get("title", "Untitled Role"),
                "company_name": j.get("company_name", "Confidential"),
                "location": j.get("location", "Remote"),
                "experience_required": j.get("minExperienceRequired", "Not specified"),
                "skills_required": skills,
                "description_snippet": str(j.get("description", ""))[:400]
            })

        prompt = f"""
You are an expert AI Career Matchmaker & Recruiter.
Analyze this candidate's resume and evaluate fit against the {len(simplified_jobs)} retrieved job postings below.

Candidate Resume Text:
\"\"\"{resume_text[:2500]}\"\"\"

Retrieved Jobs:
{json.dumps(simplified_jobs, indent=2)}

Perform the following for each job:
1. Calculate a realistic "match_score" (integer percentage 0-100).
2. Generate a "rephrased_pitch": A punchy, customized 2-sentence value proposition explaining why this candidate specifically fits this job.
3. Identify "matching_skills": Skills from the candidate's resume that match the job.
4. Identify "missing_skills": Skills mentioned in the job that the candidate could develop.
5. Provide "experience_fit": Clear seniority/years analysis.
6. Provide "project_alignment": How candidate projects connect to the job requirements.
7. Provide "reasoning_summary": Concise 1-sentence synthesis.

Return ONLY a valid JSON array matching this exact schema, without markdown code fences:
[
  {{
    "job_id": "string",
    "match_score": 88,
    "rephrased_pitch": "string",
    "matching_skills": ["skill1", "skill2"],
    "missing_skills": ["skill3"],
    "experience_fit": "string",
    "project_alignment": "string",
    "reasoning_summary": "string"
  }}
]
"""

        model = get_active_gemini_model()
        # Extended timeout prevents 504 Deadline Expired errors on multi-job batches
        response = model.generate_content(prompt, request_options={"timeout": 600})

        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        try:
            ai_evaluations = json.loads(response_text.strip())
        except Exception as json_err:
            print(f"⚠️ JSON Parse fallback. Raw output: {response_text[:300]}")
            ai_evaluations = []

        # Merge LLM-redesigned reasoning back into full job documents
        evaluated_map = {item["job_id"]: item for item in ai_evaluations if "job_id" in item}

        enriched_matches = []
        for job in available_jobs:
            j_id = str(job["_id"])
            eval_data = evaluated_map.get(j_id, {})
            
            job["ai_insights"] = {
                "match_score": eval_data.get("match_score", 80),
                "rephrased_pitch": eval_data.get("rephrased_pitch", "Strong overall background alignment with role requirements."),
                "matching_skills": eval_data.get("matching_skills", []),
                "missing_skills": eval_data.get("missing_skills", []),
                "experience_fit": eval_data.get("experience_fit", "Seniority matches job criteria."),
                "project_alignment": eval_data.get("project_alignment", "Relevant domain and project experience demonstrated."),
                "reasoning_summary": eval_data.get("reasoning_summary", "Recommended candidate match.")
            }
            enriched_matches.append(job)

        # Sort highest match score first
        enriched_matches.sort(key=lambda x: x["ai_insights"]["match_score"], reverse=True)

        return {
            "success": True,
            "tier": "Pro" if user_is_pro else "Free",
            "total_matches": len(enriched_matches),
            "matches": enriched_matches,
            # 🟢 FIX: We now return 5000 characters to the frontend so chat.py gets the exact same string
            "resumeText": resume_text[:5000] 
        }

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Analysis Error: {error_msg}")
        if "504" in error_msg or "Deadline" in error_msg:
            raise HTTPException(status_code=504, detail="AI processing timeout. Please retry.")
        if "429" in error_msg or "Quota" in error_msg:
            raise HTTPException(status_code=429, detail="Rate limit reached. Please wait 30 seconds.")
        raise HTTPException(status_code=500, detail=error_msg)


class CoverLetterRequest(BaseModel):
    resume_text: str
    job_title: Optional[str] = "Job Role"
    company_name: Optional[str] = "Hiring Company"
    job_description: Optional[str] = "Standard job description"


@router.post("/cover-letter")
async def generate_cover_letter(data: CoverLetterRequest):
    try:
        model = get_active_gemini_model()
        prompt = f"""
        Act as an expert career coach. Write a tailored, highly professional cover letter connecting:
        Resume: {data.resume_text}
        Job: {data.job_title} at {data.company_name}
        Description: {data.job_description}
        Output ONLY the text of the cover letter.
        """
        response = model.generate_content(prompt, request_options={"timeout": 300})
        return {"success": True, "cover_letter": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))