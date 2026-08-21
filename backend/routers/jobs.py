import re
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Query, HTTPException
from database import jobs_collection

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

def serialize_job(job):
    if job and "_id" in job:
        job["_id"] = str(job["_id"])
    return job

@router.get("")
async def get_jobs(
    source: Optional[str] = Query('All'),
    category: Optional[str] = Query('All'),
    jobType: Optional[str] = Query('All'),
    expYears: Optional[str] = Query('All'),
    skill: Optional[str] = Query('All'),
    location: Optional[str] = Query('All'),
    search: Optional[str] = Query(''),
    datePosted: Optional[str] = Query('All'),
    workplaceType: Optional[str] = Query('All'), 
    domainTag: Optional[str] = Query('All'),     
    employmentType: Optional[str] = Query('All'),
    company: Optional[str] = Query(''),          
    page: Optional[int] = Query(1)
):
    try:
        limit = 10
        conditions = []

        # 1. Platform Source Filter (Includes "Job Dekho" mapping to "Direct Employer")
        if source and source != 'All':
            if source.lower() == 'job dekho':
                conditions.append({"via": {"$regex": "Direct Employer|Job Dekho", "$options": "i"}})
            else:
                conditions.append({"via": {"$regex": source, "$options": "i"}})

        # 2. Company Filter
        if company and company.strip():
            conditions.append({"company_name": {"$regex": company.strip(), "$options": "i"}})

        # 3. Location Filter (Fixed: added back with equal weight)
        if location and location != 'All':
            conditions.append({"location": {"$regex": location, "$options": "i"}})

        # 4. Job Type / Workplace Type Filter
        if jobType and jobType != 'All':
            conditions.append({"jobType": {"$regex": jobType, "$options": "i"}})

        if workplaceType and workplaceType != 'All':
            conditions.append({"location": {"$regex": workplaceType, "$options": "i"}})

        # 5. Specialized Domain Tags
        if domainTag and domainTag != 'All':
            conditions.append({"$or": [
                {"title": {"$regex": domainTag, "$options": "i"}},
                {"description": {"$regex": domainTag, "$options": "i"}},
                {"ai_tags.skills": {"$regex": domainTag, "$options": "i"}}
            ]})

        # 6. Date Posted Filter
        if datePosted and datePosted != 'All':
            now = datetime.utcnow()
            if datePosted == '24h':
                delta = now - timedelta(hours=24)
            elif datePosted == 'week':
                delta = now - timedelta(days=7)
            elif datePosted == 'month':
                delta = now - timedelta(days=30)
            else:
                delta = None
                
            if delta:
                conditions.append({"$or": [
                    {"created_at": {"$gte": delta}},
                    {"posted_date": {"$gte": delta}}
                ]})

        # 7. Employment Type Filter
        if employmentType and employmentType != 'All':
            conditions.append({"$or": [
                {"employment_type": {"$regex": employmentType, "$options": "i"}},
                {"description": {"$regex": employmentType, "$options": "i"}}
            ]})

        # 8. Role Category Filter
        if category and category != 'All':
            conditions.append({"ai_tags.role_category": {"$regex": category, "$options": "i"}})

        # 9. Experience Level Filter (Equal weight across tags and schema fields)
        # 8. Experience Level Filter (Maps 0-1 to Fresher / Entry-level roles)
        if expYears and expYears != 'All':
            if expYears == '0-1':
                conditions.append({"$or": [
                    {"minExperienceRequired": {"$regex": "0|1|Fresher|Entry", "$options": "i"}},
                    {"ai_tags.experience_level": {"$regex": "0|1|Fresher|Entry", "$options": "i"}}
                ]})
            else:
                conditions.append({"$or": [
                    {"ai_tags.experience_level": {"$regex": expYears, "$options": "i"}},
                    {"minExperienceRequired": {"$regex": expYears, "$options": "i"}}
                ]})

        # 10. Skill Filter (Equal weight across tags and schema fields)
        if skill and skill != 'All':
            conditions.append({"$or": [
                {"ai_tags.skills": {"$regex": skill, "$options": "i"}},
                {"skills": {"$regex": skill, "$options": "i"}}
            ]})

        # 11. Robust NLP Semantic Search
        if search and search.strip():
            clean_search = re.sub(r'[^\w\s]', '', search.lower())
            tokens = [t for t in clean_search.split() if len(t) > 1]
            
            for token in tokens:
                regex_pattern = f"\\b{token}\\b"
                conditions.append({"$or": [
                    {"title": {"$regex": regex_pattern, "$options": "i"}},
                    {"description": {"$regex": regex_pattern, "$options": "i"}},
                    {"ai_tags.skills": {"$regex": regex_pattern, "$options": "i"}},
                    {"title": {"$regex": token, "$options": "i"}}, 
                    {"company_name": {"$regex": token, "$options": "i"}}
                ]})

        # Combine all queries with equal weight using $and
        query = {"$and": conditions} if conditions else {}
        skip = max(0, (page - 1) * limit)
        
        cursor = jobs_collection.find(query).sort("_id", -1).skip(skip).limit(limit)
        
        jobs = [serialize_job(doc) for doc in cursor]
        total = jobs_collection.count_documents(query)

        return {
            "success": True, 
            "data": jobs, 
            "hasMore": skip + len(jobs) < total,
            "total_matches": total
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")