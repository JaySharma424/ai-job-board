import json
import re
import time
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# IMPORT YOUR EXISTING, WORKING DATABASE CONNECTION (Connects to Atlas 'test' db)
from database import jobs_collection

# Path to your local JSON
JSON_PATH = "../jobs_data.json" 

def fast_clean_description(text: str) -> str:
    """Advanced Regex to fix clumping, headers, and bullet points perfectly"""
    if not text or not isinstance(text, str):
        return ""
    
    # 1. Un-clump Headers (e.g. "Key ResponsibilitiesBuild" -> "Key Responsibilities:\n\nBuild")
    common_headers = [
        "Required Skills", "Key Responsibilities", "Qualifications", 
        "Job Description", "Role Description", "About Us", "Requirements",
        "Company Description", "Role", "Responsibilities", "Must Have",
        "Job Overview"
    ]
    for header in common_headers:
        text = re.sub(rf'({header})([A-Z])', r'\1:\n\n\2', text, flags=re.IGNORECASE)

    # 2. Fix CamelCase Clumping ("datasets.Analyze" -> "datasets.\n\nAnalyze")
    text = re.sub(r'([a-z0-9\.])([A-Z][a-z]+)', r'\1\n\2', text)

    # 3. FORCE Bullet Points to new lines (Fixes the issue seen in your Atlas screenshot)
    # Looks for a bullet/dash that isn't preceded by a newline, and forces a newline
    text = re.sub(r'([^\n])(\s*[-•*]\s+[A-Z])', r'\1\n\n\2', text)
    
    return text.strip()

def normalize_job_record(job: dict) -> dict:
    """Enhances and normalizes all job details into a perfect schema"""
    clean_job = {}
    
    # Core IDs
    clean_job["job_id"] = str(job.get("job_id", job.get("_id", uuid.uuid4())))
    clean_job["title"] = str(job.get("title", "Unknown Role")).strip()
    clean_job["company_name"] = str(job.get("company_name", "Confidential")).strip()
    
    # Location & Work Model
    clean_job["location"] = str(job.get("location", "Remote")).strip()
    clean_job["locationRequirement"] = str(job.get("locationRequirement", "Not Specified")).strip()
    clean_job["employmentType"] = str(job.get("employmentType", job.get("schedule_type", "Full-time"))).strip()
    
    # Experience Handling
    clean_job["minExperienceRequired"] = job.get("minExperienceRequired")
    clean_job["maxExperienceRequired"] = job.get("maxExperienceRequired")
    
    # Domain & Alternative Roles
    clean_job["domain"] = str(job.get("domain", "")).strip()
    clean_job["roles"] = str(job.get("roles", "")).strip()
    
    # Smart Skills Extraction (Merges raw skills with ai_tags)
    direct_skills = job.get("skills")
    ai_skills = job.get("ai_tags", {}).get("skills", [])
    
    if direct_skills and direct_skills not in ["Not mentioned", "null", None]:
        clean_job["skills"] = str(direct_skills).strip()
    else:
        clean_job["skills"] = ", ".join(ai_skills) if isinstance(ai_skills, list) else str(ai_skills)
        
    clean_job["ai_tags"] = job.get("ai_tags", {})
    
    # Descriptions (Keep raw for LLM processing later, but add the perfectly formatted one for UI)
    raw_desc = job.get("description", "")
    clean_job["description"] = raw_desc
    clean_job["formattedDescription"] = fast_clean_description(raw_desc)
    
    # Meta data
    clean_job["via"] = job.get("via", "")
    clean_job["apply_options"] = job.get("apply_options", "")
    clean_job["query"] = job.get("query", "")
    clean_job["posted_at"] = job.get("posted_at", "")
    
    return clean_job

def run_fast_seed():
    print("📂 Loading local JSON file...")
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
            jobs = raw_data.get("jobs", raw_data) if isinstance(raw_data, dict) else raw_data
    except Exception as e:
        print(f"❌ Failed to load JSON. Check path: {e}")
        return
        
    print(f"📦 Loaded {len(jobs)} jobs. Enhancing and Normalizing data in memory...")
    start = time.time()
    
    enhanced_jobs = [normalize_job_record(job) for job in jobs]
        
    print(f"✨ Enhanced {len(enhanced_jobs)} records perfectly in {time.time() - start:.2f} seconds!")

    print("🗑️ Wiping existing MongoDB collection...")
    # This uses your working Atlas connection from database.py
    jobs_collection.delete_many({})
    
    print("🚀 Bulk inserting clean, normalized jobs to MongoDB Atlas...")
    BATCH_SIZE = 5000
    for i in range(0, len(enhanced_jobs), BATCH_SIZE):
        batch = enhanced_jobs[i : i + BATCH_SIZE]
        jobs_collection.insert_many(batch)
        print(f"📤 Uploaded {min(i + BATCH_SIZE, len(enhanced_jobs))}/{len(enhanced_jobs)} to Atlas...")
        
    print("🎉 Database successfully wiped, cleaned, normalized, and re-seeded!")

if __name__ == "__main__":
    run_fast_seed()