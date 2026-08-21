import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise ValueError("Please define the MONGODB_URI environment variable in your .env file")

client = MongoClient(MONGODB_URI)

try:
    # Attempts to read the DB name directly from the .env string
    db = client.get_default_database()
except Exception:
    # Fallback to 'test' if the .env string doesn't specify a database
    db = client.get_database("test")

# Existing collections
jobs_collection = db["jobs"]
users_collection = db["users"]
notifications_collection = db["notifications"]
# NEW Collections for Step 5
profiles_collection = db["profiles"]
applications_collection = db["applications"]
saved_jobs_collection = db["saved_jobs"]

print("✅ Successfully connected to MongoDB!")