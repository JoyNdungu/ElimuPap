from pydantic import BaseModel
from typing import List

class UnitCreate(BaseModel):
    unit_code: str
    unit_name: str
    topics: List[str] = []

class UnitUpdate(BaseModel):
    unit_code: str = None
    unit_name: str = None
    topics: List[str] = None
