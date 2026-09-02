from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

# 3.6.1 Users Table
class UserModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    full_name: str
    email: str
    password_hash: str
    university: str
    course: str
    year_of_study: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.2 Notes Table
class NoteModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    unit_name: Optional[str] = None
    unit_code: Optional[str] = None
    topic: Optional[str] = None
    file_name: str
    file_type: str
    cloudinary_url: Optional[str] = None
    extracted_text: str
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    status: str = "completed" # uploaded, processing, completed, failed

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.3 Summaries Table
class SummaryModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    note_id: str
    summary_text: str
    key_points: List[str] = []
    definitions: List[Dict[str, str]] = []
    revision_questions: List[str] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.4 Tutor Conversations Table
class TutorConversationModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    note_id: Optional[str] = None
    unit_name: Optional[str] = None
    question: str
    answer: str
    source_chunks: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.5 Quizzes Table
class QuizModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    note_id: Optional[str] = None
    unit_name: Optional[str] = None
    topic: Optional[str] = None
    questions: List[Dict[str, Any]] = [] # list of generated quiz questions
    quiz_type: str # multiple-choice or short-answer
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.6 Quiz Attempts Table
class QuizAttemptModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    quiz_id: str
    topic: Optional[str] = None
    answers: Dict[str, Any] = {} # user submitted answers
    score: int
    total_questions: int
    correct_answers: int
    incorrect_answers: int
    attempt_date: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.7 Weak Topics Table
class WeakTopicModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    unit_name: Optional[str] = None
    topic: str
    weakness_score: float
    recommended_revision_frequency: str
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 3.6.8 Study Plans Table
class StudyPlanModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    exam_date: Optional[datetime] = None
    weekly_schedule: List[Dict[str, Any]] = []
    priority_topics: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
