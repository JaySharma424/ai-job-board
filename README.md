```markdown
# 🚀 Enterprise AI-Powered Smart Career Portal

A production-grade, full-stack career platform utilizing **Retrieval-Augmented Generation (RAG)** to intelligently match candidates with over 50,000+ indexed job opportunities. This application features a decoupled architecture separating a high-performance **Next.js Frontend** from a robust, asynchronous **Python FastAPI Backend**.

---

## 🏗 System Architecture

The application is structured into a modern client-server decoupled layout optimized for scalability, heavy natural language processing (NLP), and AI workload management:

```text
┌─────────────────────────┐          HTTP / JSON API          ┌─────────────────────────┐
│                         │ ────────────────────────────────> │                         │
│   Next.js 16 Frontend   │                                   │   Python FastAPI Core   │
│   (React / Tailwind)    │ <──────────────────────────────── │    (Uvicorn / PyMongo)  │
└─────────────────────────┘          REST Responses           └─────────────────────────>
         Port 3000                                                     Port 8000
                                                                           │
                                                                           ▼
                                                              ┌─────────────────────────┐
                                                              │  MongoDB Atlas Cluster  │
                                                              │  (Jobs & Users DB)      │
                                                              └─────────────────────────┘
                                                                           │
                                                                           ▼
                                                              ┌─────────────────────────┐
                                                              │  Google Gemini 1.5 Flash│
                                                              │  (RAG & Chat AI Engine) │
                                                              └─────────────────────────┘

```

---

## 📂 Project Directory Structure

```text
ai-job-board/
├── app/                      # Next.js 16 App Router (Frontend UI)
│   ├── globals.css           # Tailwind CSS styling and animations
│   ├── layout.tsx            # Root application layout wrapper
│   └── page.tsx              # Main dashboard, search UI, and client state[cite: 1]
├── backend/                  # Python FastAPI Backend
│   ├── routers/              # Modular API Route Controllers
│   │   ├── __init__.py       # Package initializer
│   │   ├── auth.py           # Authentication, JWT/Bcrypt, and Resend Recovery
│   │   ├── jobs.py           # Advanced NLP Semantic Search & Regex Filters
│   │   ├── resume.py         # pypdf Text Extraction & RAG Citation Engine
│   │   └── chat.py           # Context-Aware AI Chatbot Assistant
│   ├── .env                  # Backend environment secrets
│   ├── database.py           # PyMongo MongoDB Atlas connection client
│   ├── main.py               # FastAPI entry point, CORS middleware, and routing
│   ├── models.py             # Pydantic data validation schemas
│   └── requirements.txt      # Python backend dependencies
├── package.json              # Next.js frontend dependencies configuration
├── tsconfig.json             # TypeScript configuration
└── README.md                 # Project documentation

```

---

## 🛠 Core Technical Features

### 1. RAG-Based Resume Matching & Citations

* **PDF Parsing:** Utilizes Python's `pypdf` library to reliably extract raw text from uploaded candidate resumes.


* **Structured Citations:** Interacts with Google Gemini 1.5 Flash to evaluate resumes against database listings, delivering explicit breakdown citations categorized into:
* **Skills Citation:** Overlapping technical stack matching.
* **Experience Citation:** Candidate seniority vs. job requirements alignment.
* **Project Citation:** Domain and project background relevance.



### 2. Advanced NLP Semantic Search & Filtering

* Powered by custom Python regex engines and PyMongo queries to parse semantic queries, filter multi-platform job boards (LinkedIn, Indeed, Naukri, Glassdoor, etc.), normalize experience brackets (`0-1`, `1-3`, `3-5`, `5+`), and dynamically paginate results.

### 3. Secure Authentication & Email Recovery

* Implements enterprise-grade password hashing via `passlib[bcrypt]` and automated recovery workflows using the **Resend API** to securely dispatch HTML password-reset links to registered Gmail addresses.

---

## 💻 Local Development Setup

### Prerequisites

* Python 3.10+ installed
* Node.js 18+ installed
* MongoDB Atlas Database connection string
* Google Gemini API Key (`GEMINI_API_KEY`)
* Resend API Key (`RESEND_API_KEY`)

### Step 1: Configure Environment Variables

Create a file named **`.env`** inside the `backend/` directory:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
RESEND_API_KEY=your_resend_api_key

```

### Step 2: Initialize the Python Backend

```bash
cd backend
python -m venv venv
# Windows Activation:
venv\Scripts\activate
# Mac/Linux Activation:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000

```

### Step 3: Initialize the Next.js Frontend

Open a separate terminal window from the root project directory:

```bash
npm install
npm run dev

```

* Access the user interface at `http://localhost:3000`
* Access the interactive FastAPI documentation docs at `http://localhost:8000/docs`

---

## ☁️ Production Deployment Strategy

1. **Frontend Deployment (Vercel):**
* Push your Next.js project repository to GitHub and import it into Vercel.
* Configure production environment variables pointing to your live backend URL.


2. **Backend Deployment (Render / Railway / AWS):**
* Deploy the `backend/` folder as a Python web service.
* Set the build command to `pip install -r requirements.txt`.
* Set the start command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
* Add all production `.env` variables securely into your cloud host provider's environment settings.



```

```