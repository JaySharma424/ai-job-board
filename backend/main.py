from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import modular routers
from routers import auth, jobs, resume, chat, user, premium, employer
from vector_db import init_vector_db

app = FastAPI(title="AI Job Board API")

# Automatically initialize Qdrant vector collection on server startup
@app.on_event("startup")
async def startup_event():
    print("🚀 Initializing Vector Database...")
    init_vector_db()
    print("Initializing Successfull of Vector Database.....")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# Register all routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(resume.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(premium.router) 
app.include_router(employer.router)

@app.get("/")
async def root():
    return {"message": "AI Job Board API is running smoothly!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)