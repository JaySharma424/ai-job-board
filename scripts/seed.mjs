import mongoose from 'mongoose';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// We redefine the schema briefly here for the seed script to keep it self-contained
const JobSchema = new mongoose.Schema({
  job_id: { type: String, unique: true },
  title: String,
  company_name: String,
  description: String,
  formattedDescription: String,
  location: String,
  skills: String,
  via: String,
  apply_options: String,
  minExperienceRequired: String,
  maxExperienceRequired: String
});

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

async function seedDatabase() {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
    
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Read the JSON file
    const rawData = fs.readFileSync(path.resolve(__dirname, '../jobs_data.json'), 'utf-8');
    const jobs = JSON.parse(rawData);

    console.log(`Total raw jobs found: ${jobs.length}`);

    // Deduplication Logic: Filter out duplicate job_ids
    const uniqueJobsMap = new Map();
    jobs.forEach(job => {
      // Use job_id as the primary deduplication key. 
      // If job_id doesn't exist, fallback to title+company combo.
      const uniqueKey = job.job_id || `${job.title}-${job.company_name}`;
      
      if (!uniqueJobsMap.has(uniqueKey)) {
        uniqueJobsMap.set(uniqueKey, {
          job_id: job.job_id,
          title: job.title,
          company_name: job.company_name,
          description: job.description,
          formattedDescription: job.formattedDescription,
          location: job.location,
          skills: job.skills,
          via: job.via,
          apply_options: job.apply_options,
          minExperienceRequired: job.minExperienceRequired,
          maxExperienceRequired: job.maxExperienceRequired
        });
      }
    });

    const uniqueJobsArray = Array.from(uniqueJobsMap.values());
    console.log(`Total unique jobs after deduplication: ${uniqueJobsArray.length}`);

    // Clear existing jobs (optional, useful for resetting)
    await Job.deleteMany({});
    console.log("🗑️  Cleared existing jobs");

    // Insert new deduplicated jobs
    await Job.insertMany(uniqueJobsArray);
    console.log("🎉 Successfully seeded deduplicated jobs into the database!");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    mongoose.disconnect();
  }
}

seedDatabase();