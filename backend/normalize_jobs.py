import re
import spacy
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# IMPORT YOUR EXISTING, WORKING DATABASE CONNECTION
from database import jobs_collection

# Initialize NLP Model
print("🧠 Loading spaCy NLP model...")
nlp = spacy.load("en_core_web_sm")

def nlp_enhance_description(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""

    # 1. Un-clump Headers
    common_headers = [
        "Required Skills", "Key Responsibilities", "Qualifications", 
        "Job Description", "Role Description", "About Us", "Requirements",
        "Company Description", "Role", "Responsibilities", "Must Have"
    ]
    for header in common_headers:
        # Regex looks for the header immediately followed by an Uppercase letter
        text = re.sub(rf'({header})([A-Z])', r'\1:\n\n\2', text, flags=re.IGNORECASE)

    # 2. General Boundary Un-clumping (e.g., "mockups.Write Code" -> "mockups.\n\nWrite Code")
    text = re.sub(r'([a-z0-9\.])([A-Z][a-z]+)', r'\1\n\2', text)

    # 3. Clean up weird bullet point spacing
    text = re.sub(r'([^\n])(\s*[-•]\s+[A-Z])', r'\1\n\n\2', text)

    # 4. Use spaCy NLP to ensure proper sentence boundaries
    # Note: Spacy max length is increased to prevent memory limits on huge descriptions
    nlp.max_length = 2000000 
    
    # Process text safely
    try:
        doc = nlp(text)
        clean_sentences = []
        for sent in doc.sents:
            cleaned = sent.text.strip()
            cleaned = re.sub(r'\s+', ' ', cleaned)
            if cleaned:
                clean_sentences.append(cleaned)
        final_text = "\n".join(clean_sentences)
    except Exception as e:
        # If NLP fails for a bizarre character, fallback to basic regex cleaning
        final_text = text

    return final_text

def run_normalization():
    print("🚀 Starting NLP Job Description Normalization Pipeline...")
    
    # Only target jobs that haven't been formatted yet to save time
    query = {}
    total_remaining = jobs_collection.count_documents(query)
    
    if total_remaining == 0:
        print("💡 Formatted descriptions already exist. Targeting ALL jobs to force update...")
        query = {}
        total_remaining = jobs_collection.count_documents(query)
        
    print(f"📦 Found {total_remaining} jobs to process. Enhancing text...")

    cursor = jobs_collection.find(query).batch_size(100)
    updated_count = 0
    
    for job in cursor:
        raw_desc = job.get('description', '')
        
        # Apply NLP enhancement
        beautiful_desc = nlp_enhance_description(raw_desc)
        
        # Save back to MongoDB safely
        jobs_collection.update_one(
            {"_id": job["_id"]},
            {"$set": {"formattedDescription": beautiful_desc}}
        )
        
        updated_count += 1
        if updated_count % 100 == 0:
            print(f"⚡ Normalized {updated_count}/{total_remaining} jobs...")

    print("🎉 Database Normalization Complete! Job descriptions are now perfectly spaced.")

if __name__ == "__main__":
    run_normalization()