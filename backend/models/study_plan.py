from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FocusAreaBase(BaseModel):
    unit_name: str
    topic_name: str
    mastery_percentage: int = Field(ge=0, le=100)
    priority: bool = False

class FocusAreaCreate(FocusAreaBase):
    pass

class FocusAreaUpdate(BaseModel):
    unit_name: Optional[str] = None
    topic_name: Optional[str] = None
    mastery_percentage: Optional[int] = None
    priority: Optional[bool] = None

class StudyTaskBase(BaseModel):
    title: str
    description: str
    scheduled_time: datetime
    is_completed: bool = False

class StudyTaskCreate(StudyTaskBase):
    pass

class StudyTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    is_completed: Optional[bool] = None
