from pydantic import BaseModel, field_validator
from typing import Optional
import re

# Pydantic models define the shape of data
# FastAPI uses these to automatically validate
# incoming requests — if a required field is 
# missing FastAPI rejects the request automatically

class UserRegister(BaseModel):
    """Data expected when a student registers"""
    name: str
    email: str
    password: str
    university: str
    course: str
    year_of_study: str
    language: Optional[str] = "english"

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one capital letter')
        if not re.search(r'[0-9!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one number or special character')
        return v

class UserLogin(BaseModel):
    """Data expected when a student logs in"""
    email: str
    password: str