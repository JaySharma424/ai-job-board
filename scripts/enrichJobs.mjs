import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in .env");

// Schema definition
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
  maxExperienceRequired: String,
  ai_tags: {
    skills: [String],
    role_category: String,
    keywords: [String],
    experience_level: String,
  }
});

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3.5-flash",
  generationConfig: { responseMimeType: "application/json" }
});

// Helper sleep function to respect API rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function enrichJobs() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Fetch jobs that haven't been tagged yet, LIMIT to 50 for the prototype
    const jobsToEnrich = await Job.find({
      $or: [
        { ai_tags: { $exists: false } },
        { "ai_tags.skills": { $size: 0 } }
      ]
    }).limit(10); // <-- Added a limit here!

    console.log(`Found ${jobsToEnrich.length} jobs to enrich with AI.`);

    for (let i = 0; i < jobsToEnrich.length; i++) {
      const job = jobsToEnrich[i];
      console.log(`[${i + 1}/${jobsToEnrich.length}] Processing: ${job.title} at ${job.company_name}...`);

      const textToAnalyze = job.formattedDescription || job.description || job.title;

      const prompt = `
You are an expert technical recruiter and data analyst. Analyze this job listing and extract structured technical metadata.

Job Title: ${job.title}
Company: ${job.company_name}
Content:
${textToAnalyze}

Return ONLY valid JSON matching this exact structure:
{
  "skills": ["string", "string"],
  "role_category": "string (e.g., Data Science, Software Engineering, Web Development, Cloud/DevOps, Business Analytics)",
  "keywords": ["string", "string (e.g., Generative AI, REST API, MERN, AWS)"],
  "experience_level": "string (e.g., Fresher, Entry-Level (0-2 yrs), Mid-Level (2-5 yrs), Senior (5+ yrs))"
}
`;

      try {
        const result = await model.generateContent(prompt);
        const parsedResponse = JSON.parse(result.response.text());

        job.ai_tags = {
          skills: parsedResponse.skills || [],
          role_category: parsedResponse.role_category || "Other",
          keywords: parsedResponse.keywords || [],
          experience_level: parsedResponse.experience_level || "Not specified"
        };

        await job.save();
        console.log(`✅ Successfully enriched: ${job.title}`);
      } catch (err) {
        console.error(`❌ Failed to enrich job ID ${job.job_id}:`, err.message);
      }

      // 4-second pause to safely stay under the 15 Requests Per Minute free tier limit
      await sleep(4000); 
    }

    console.log("\n🎉 All 50 prototype jobs have been enriched with AI tags!");
  } catch (error) {
    console.error("Enrichment process encountered an error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

enrichJobs();