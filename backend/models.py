from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime


# ==========================================
# USER MODELS
# ==========================================

class UserCreate(BaseModel):
    """Schema for incoming registration/login requests"""
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    """Schema for requesting a password reset"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for submitting a new password"""
    email: EmailStr
    resetToken: str
    newPassword: str


# ==========================================
# JOB MODELS
# ==========================================

class AITags(BaseModel):
    """Sub-schema for AI-generated tags attached to jobs"""
    role_category: Optional[str] = None
    experience_level: Optional[str] = None
    skills: List[str] = Field(default_factory=list)


class JobResponse(BaseModel):
    """Schema for outgoing Job data (what the frontend receives)"""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    title: str
    company_name: str
    location: Optional[str] = None
    description: Optional[str] = None
    formattedDescription: Optional[str] = None
    via: Optional[str] = None
    minExperienceRequired: Optional[str] = None
    ai_tags: Optional[AITags] = None

    # RAG Recommendation fields
    skills_matched: Optional[List[str]] = None
    experience_fit: Optional[str] = None
    project_alignment: Optional[str] = None
    recommendation_reason: Optional[str] = None


# ==========================================
# CHATBOT MODELS
# ==========================================

class ChatHistoryMessage(BaseModel):
    """One previous message sent to the adaptive career coach."""
    role: Literal["user", "assistant", "bot"]
    text: str = Field(min_length=1, max_length=10000)
    feedback: Optional[Literal["up", "down"]] = None


class ChatRequest(BaseModel):
    """
    Main chatbot request with an optional session_id fallback.
    """
    session_id: Optional[str] = Field(default="default_session", min_length=2, max_length=128)
    message: str = Field(min_length=1, max_length=2000)
    resumeText: str = Field(default="", max_length=20000)
    jobContext: List[Dict[str, Any]] = Field(default_factory=list)
    history: List[Any] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Standard response returned by the career coach API."""
    success: bool = True
    response: str
    suggestions: List[str] = Field(default_factory=list)
    memoryUpdated: bool = False


# ==========================================
# FEEDBACK_EVENTS TABLE / RECORD
# ==========================================

class ChatFeedback(BaseModel):
    """
    Persistent feedback record.

    Recommended database table/collection: feedback_events
    """
    id: Optional[str] = None
    session_id: str = Field(min_length=8, max_length=128)
    user_id: Optional[str] = None
    message_id: Optional[str] = None

    user_message: str = Field(min_length=1, max_length=2000)
    assistant_response: str = Field(min_length=1, max_length=10000)

    feedback: Literal["up", "down"]
    feedback_text: Optional[str] = Field(default=None, max_length=2000)

    created_at: datetime = Field(default_factory=datetime.utcnow)


class FeedbackRequest(BaseModel):
    """Payload sent when the user clicks 👍 / 👎."""
    session_id: str = Field(min_length=8, max_length=128)
    user_id: Optional[str] = None
    message_id: Optional[str] = None
    user_message: str = Field(min_length=1, max_length=2000)
    assistant_response: str = Field(min_length=1, max_length=10000)
    feedback: Literal["up", "down"]
    feedback_text: Optional[str] = Field(default=None, max_length=2000)


class FeedbackResponse(BaseModel):
    """Response after feedback has been persisted."""
    success: bool = True
    message: str
    memoryUpdated: bool = False


# ==========================================
# COACH_MEMORY TABLE / RECORD
# ==========================================

class CoachMemory(BaseModel):
    """
    Persistent adaptive prompt/profile.

    Recommended database table/collection: coach_memory
    """
    id: Optional[str] = None
    session_id: str = Field(min_length=8, max_length=128)
    user_id: Optional[str] = None

    # Compact instructions injected into future LLM prompts.
    learned_prompt: str = Field(default="", max_length=4000)

    # Feedback analytics.
    positive_feedback_count: int = Field(default=0, ge=0)
    negative_feedback_count: int = Field(default=0, ge=0)
    total_feedback_count: int = Field(default=0, ge=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CoachMemoryResponse(BaseModel):
    """Safe response for displaying/debugging adaptive memory."""
    success: bool = True
    session_id: str
    learned_prompt: str
    positive_feedback_count: int = 0
    negative_feedback_count: int = 0
    total_feedback_count: int = 0
    updated_at: Optional[datetime] = None


# ==========================================
# PROMPT REFINEMENT MODELS
# ==========================================

class PromptRefinementInput(BaseModel):
    """
    Internal input for adaptive prompt refinement.

    Refinement uses:
      1. latest user request
      2. generated LLM response
      3. explicit user feedback
      4. existing learned prompt
    """
    existing_prompt: str = Field(default="", max_length=4000)
    user_message: str = Field(min_length=1, max_length=2000)
    assistant_response: str = Field(min_length=1, max_length=10000)
    feedback: Optional[Literal["up", "down"]] = None
    feedback_text: Optional[str] = Field(default=None, max_length=2000)


class PromptRefinementResponse(BaseModel):
    """Result produced by the prompt-refinement layer."""
    learned_prompt: str = Field(max_length=4000)
    memory_updated: bool = True


# ==========================================
# ADAPTIVE CHAT RESPONSE
# ==========================================

class ChatSuggestion(BaseModel):
    """Context-aware next action shown below an AI response."""
    label: str
    prompt: str


class AdaptiveChatResponse(BaseModel):
    """Extended response used by the adaptive career-coach UI."""
    success: bool = True
    response: str
    suggestions: List[ChatSuggestion] = Field(default_factory=list)
    memoryUpdated: bool = False
    message_id: Optional[str] = None

# ==========================================
# USER PROFILE & TRACKING MODELS (STEP 5)
# ==========================================

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "candidate"  # "candidate" or "employer"


class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str

class NotificationSchema(BaseModel):
    email: EmailStr
    title: str
    message: str
    type: str = "info" # "success", "info", "warning"
    read: bool = False
    created_at: str
    
class UserProfileSchema(BaseModel):
    """Schema for a user's full professional profile"""
    email: EmailStr
    name: Optional[str] = "Add Your Name"
    title: Optional[str] = "Add Current Role"
    location: Optional[str] = "Add Location"
    phone: Optional[str] = "+91 Add Number"
    skills: List[str] = Field(default_factory=list)
    bio: Optional[str] = "Add a brief summary of your professional background."
    resume_text: Optional[str] = ""
    resume_filename: Optional[str] = ""
    is_premium: bool = False  # <--- NEW FLAG FOR PAYMENT TRACKING

class AppliedJobSchema(BaseModel):
    """Schema for tracking job applications"""
    email: EmailStr
    job_id: str
    title: str
    company_name: str
    location: str
    appliedAt: str
    status: str = "Under Review"

class SavedJobSchema(BaseModel):
    """Schema for saving jobs to a wishlist"""
    email: EmailStr
    job_id: str
    title: str
    company_name: str
    location: str