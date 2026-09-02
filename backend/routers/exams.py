from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from database import exams_collection, units_collection, users_collection
from utils.auth import decode_token
from bson import ObjectId
from google import genai
import os
import shutil
import json

router = APIRouter(prefix="/exams", tags=["Exams"])

class ExamCreate(BaseModel):
    unit_code: str
    exam_date: str # YYYY-MM-DD
    exam_time: Optional[str] = None
    venue: Optional[str] = None

class ExamUpdate(BaseModel):
    exam_date: Optional[str] = None
    exam_time: Optional[str] = None
    venue: Optional[str] = None

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload.get("sub")

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_exams(user_id: str = Depends(get_current_user_id)):
    """Fetch all exams for the logged in user"""
    exams = list(exams_collection.find({"user_id": ObjectId(user_id)}).sort("exam_date", 1))
    for e in exams:
        e["id"] = str(e["_id"])
        del e["_id"]
        del e["user_id"]
    return exams

@router.post("")
@router.post("/")
def create_exam(exam: ExamCreate, user_id: str = Depends(get_current_user_id)):
    """Manually add an exam"""
    exam_dict = exam.model_dump()
    exam_dict["user_id"] = ObjectId(user_id)
    
    # Check if user has this unit registered
    unit = units_collection.find_one({"user_id": ObjectId(user_id), "unit_code": exam.unit_code})
    if not unit:
        raise HTTPException(status_code=400, detail=f"Unit {exam.unit_code} not registered in your units")
        
    result = exams_collection.insert_one(exam_dict)
    exam_dict["id"] = str(result.inserted_id)
    del exam_dict["_id"]
    del exam_dict["user_id"]
    return exam_dict

@router.delete("/{exam_id}")
def delete_exam(exam_id: str, user_id: str = Depends(get_current_user_id)):
    result = exams_collection.delete_one({"_id": ObjectId(exam_id), "user_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {"message": "Exam deleted successfully"}

@router.post("/parse")
async def parse_timetable(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    """Upload a timetable image and parse it with Gemini to auto-create exams."""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    year_of_study = user.get("year_of_study", "Unknown") if user else "Unknown"
    
    units = list(units_collection.find({"user_id": ObjectId(user_id)}))
    unit_codes = [u.get("unit_code") for u in units]
    units_info = [{"unit_code": u.get("unit_code"), "title": u.get("title")} for u in units]
    
    if not unit_codes:
        raise HTTPException(status_code=400, detail="You must register at least one unit first.")
        
    os.makedirs("uploads/tmp", exist_ok=True)
    file_path = os.path.join("uploads/tmp", file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        api_key = os.getenv("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        
        uploaded_file = client.files.upload(file=file_path)
        
        prompt = f"""
        Extract exam dates, times, and venues from this timetable image.
        The student is in Year of Study: {year_of_study}.
        The student is registered for these specific units:
        {json.dumps(units_info, indent=2)}
        
        You should extract an exam if it matches ANY of the following criteria:
        1. The unit code on the timetable matches one of the student's registered unit codes.
        2. The unit name on the timetable matches or closely resembles one of the student's registered unit titles.
        3. The exam is grouped under the student's Year of Study (e.g., Year {year_of_study} or {year_of_study}.1 or similar notation).
        
        ONLY return exams that belong to the student's registered units. 
        For each match, return the EXACT "unit_code" from the registered units list provided above.
        
        Return ONLY a JSON array of objects with the following schema:
        [
          {{
            "unit_code": "The exact registered unit code",
            "exam_date": "YYYY-MM-DD format only",
            "exam_time": "HH:MM format",
            "venue": "Room or venue string"
          }}
        ]
        """
        
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[uploaded_file, prompt],
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        parsed_exams = json.loads(response.text)
        
        created_exams = []
        for e in parsed_exams:
            if e.get("unit_code") in unit_codes:
                exam_doc = {
                    "user_id": ObjectId(user_id),
                    "unit_code": e.get("unit_code"),
                    "exam_date": e.get("exam_date"),
                    "exam_time": e.get("exam_time"),
                    "venue": e.get("venue")
                }
                # Upsert to prevent duplicates
                res = exams_collection.update_one(
                    {"user_id": ObjectId(user_id), "unit_code": e.get("unit_code")},
                    {"$set": exam_doc},
                    upsert=True
                )
                created_exams.append(exam_doc)
                
        return {"message": f"Successfully parsed {len(created_exams)} exams for your registered units."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse timetable: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
