import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from database import notes_collection, exams_collection, study_plans_collection, db
from bson import ObjectId
from utils.auth import decode_token
from fastapi.security import OAuth2PasswordBearer
from google import genai
import json
from fastapi import File, Form, UploadFile

router = APIRouter(prefix="/ai", tags=["AI Features"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user_id(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload.get("sub")

def handle_gemini_error(e: Exception) -> HTTPException:
    error_msg = str(e)
    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
        return HTTPException(status_code=429, detail="AI rate limit exceeded. Please wait about 30 seconds and try again.")
    return HTTPException(status_code=500, detail="An error occurred with the AI service. Please try again later.")

def format_stream_error(e: Exception) -> str:
    error_msg = str(e)
    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
        return "Error: AI rate limit exceeded. Please wait about 30 seconds and try again."
    return "Error: An issue occurred while communicating with the AI."

# Initialize Gemini Client
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured properly.")
    return genai.Client(api_key=api_key)

class MessageData(BaseModel):
    role: str
    content: str

class TutorRequest(BaseModel):
    note_id: Optional[str] = None
    messages: List[MessageData]

class GenerateRequest(BaseModel):
    note_id: str

class QuizRequest(BaseModel):
    note_id: str
    quiz_type: str = "multiple_choice" # "multiple_choice", "text_answer", "combination"
    num_questions: int = 5

@router.post("/tutor")
async def tutor_chat(req: TutorRequest, user_id: str = Depends(get_current_user_id)):
    client = get_gemini_client()
    
    # Retrieve context if note_id is provided
    context_text = ""
    if req.note_id:
        note = notes_collection.find_one({"_id": ObjectId(req.note_id), "user_id": ObjectId(user_id)})
        if note and "extracted_text" in note:
            context_text = f"Here is the context from the user's notes for reference:\n{note['extracted_text']}\n\n"

    # Convert to Gemini format
    gemini_messages = []
    if context_text:
        gemini_messages.append({"role": "user", "parts": [{"text": context_text + "Please act as an AI Tutor for the student using this material."}]})
        gemini_messages.append({"role": "model", "parts": [{"text": "Understood. I will act as a helpful AI Tutor based on the provided material."}]})

    for msg in req.messages:
        role = "user" if msg.role == "user" else "model"
        gemini_messages.append({"role": role, "parts": [{"text": msg.content}]})

    # Return a StreamingResponse
    def stream_generator():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-3.6-flash",
                contents=gemini_messages
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield format_stream_error(e)

    return StreamingResponse(stream_generator(), media_type="text/plain")

@router.post("/summary")
async def generate_summary(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    client = get_gemini_client()
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), "user_id": ObjectId(user_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note_text = note.get("extracted_text", "").strip()
    
    # If no text was extracted (e.g. scanned PDF), use the title as context
    if not note_text:
        note_text = f"Note Title: {note.get('title', 'Untitled')}\nUnit: {note.get('unit_code', '')}\nTopic: {note.get('topic', '')}"
    
    prompt = f"""
    Please generate a structured summary of the following notes.
    Return ONLY a valid JSON object with the following schema:
    {{
      "title": "A good title",
      "summary": "A 2-3 paragraph overview",
      "key_points": ["point 1", "point 2"],
      "definitions": [{{"term": "term", "definition": "definition"}}]
    }}
    
    Notes:
    {note_text}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/quiz")
async def generate_quiz(req: QuizRequest, user_id: str = Depends(get_current_user_id)):
    client = get_gemini_client()
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), "user_id": ObjectId(user_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note_text = note.get("extracted_text", "").strip()
    if not note_text:
        note_text = f"Note Title: {note.get('title', 'Untitled')}\nUnit: {note.get('unit_code', '')}\nTopic: {note.get('topic', '')}"
    
    quiz_instructions = ""
    if req.quiz_type == "multiple_choice":
        quiz_instructions = "Generate all multiple choice questions."
    elif req.quiz_type == "text_answer":
        quiz_instructions = "Generate all text-answer questions (where the user types in their response)."
    else:
        quiz_instructions = "Generate a balanced combination of multiple-choice and text-answer questions."

    prompt = f"""
    Generate a {req.num_questions}-question quiz based on the following notes.
    {quiz_instructions}
    
    Return ONLY a valid JSON object with the following schema:
    {{
      "quiz_title": "Quiz Title",
      "questions": [
        {{
          "type": "multiple_choice",
          "question": "Question text",
          "options": ["A", "B", "C", "D"],
          "correct_answer": "A",
          "explanation": "Why A is correct"
        }},
        {{
          "type": "text_answer",
          "question": "Question text",
          "options": [],
          "correct_answer": "The expected key points or short ideal answer",
          "explanation": "Detailed explanation of the correct answer"
        }}
      ]
    }}
    For text_answer types, you MUST include an empty "options" array.
    
    Notes:
    {note_text}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        raise handle_gemini_error(e)

class StudyPlanRequest(BaseModel):
    exam_date: str          # ISO date string e.g. "2026-11-15"
    hours_per_day: Optional[int] = 3

@router.post("/flashcards")
async def generate_flashcards(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    """Generate 10 Q&A flashcards from a note."""
    client = get_gemini_client()
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), "user_id": ObjectId(user_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note_text = note.get("extracted_text", "").strip()
    if not note_text:
        note_text = f"Note Title: {note.get('title', 'Untitled')}\nUnit: {note.get('unit_code', '')}\nTopic: {note.get('topic', '')}"

    prompt = f"""
    Generate exactly 10 flashcards based on the following notes.
    Return ONLY a valid JSON object with this schema:
    {{
      "flashcards": [
        {{
          "front": "A concise question or term",
          "back": "The answer or definition"
        }}
      ]
    }}
    Notes:
    {note_text}
    """
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/mindmap")
async def generate_mindmap(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    """Generate a mind map (nested concept tree) from a note."""
    client = get_gemini_client()
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), "user_id": ObjectId(user_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note_text = note.get("extracted_text", "").strip()
    if not note_text:
        note_text = f"Note Title: {note.get('title', 'Untitled')}\nUnit: {note.get('unit_code', '')}"

    prompt = f"""
    Create a structured mind map of the key concepts in the following notes.
    Return ONLY a valid JSON object with this schema:
    {{
      "root": "Main Topic",
      "branches": [
        {{
          "label": "Sub-topic",
          "children": ["detail 1", "detail 2"]
        }}
      ]
    }}
    Notes:
    {note_text}
    """
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/study-plan")
async def generate_study_plan(
    hours_per_day: int = Form(3),
    authorization: str = Depends(oauth2_scheme)
):
    """Generate an adaptive AI study plan based on telemetry and exams."""
    user_id = get_current_user_id(authorization)
    client = get_gemini_client()
    user_obj_id = ObjectId(user_id)

    # 1. Fetch Exams and filter out past exams
    all_exams = list(exams_collection.find({"user_id": user_obj_id}))
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    exams = [e for e in all_exams if e.get('exam_date') and e.get('exam_date') >= today_str]
    
    if not exams:
        exam_context = "STUDENT UPCOMING EXAMS:\nNone. The student has no upcoming exams, but wants to build mastery over their registered units."
    else:
        exam_context = "STUDENT UPCOMING EXAMS:\n"
        for e in exams:
            exam_context += f"- Unit: {e.get('unit_code')}, Date: {e.get('exam_date')}\n"

    # 2. Fetch Notes per Unit
    notes = list(notes_collection.find({"user_id": user_obj_id}, {"title": 1, "unit_code": 1, "topic": 1}))
    notes_by_unit = {}
    for n in notes:
        uc = n.get('unit_code', 'Unknown')
        if uc not in notes_by_unit:
            notes_by_unit[uc] = []
        notes_by_unit[uc].append(n.get('title', 'Untitled'))

    # 3. Calculate Telemetry (Mastery) per Unit
    activity_collection = db["activity_logs"]
    unit_stats = {}
    
    # We want to gather stats for units that have exams
    for e in exams:
        uc = e.get("unit_code")
        if uc not in unit_stats:
            unit_stats[uc] = {"time_spent": 0, "quizzes": 0, "flashcards": 0}
            
        logs = list(activity_collection.find({"user_id": user_obj_id, "unit_code": uc}))
        # Wait, activity logs might just have note_id. Let's find unit_code from notes.
        
        # A more robust way: find all logs for the user, map note_id to unit_code
        all_logs = list(activity_collection.find({"user_id": user_obj_id}))
        note_to_unit = {str(n["_id"]): n.get("unit_code") for n in notes}
        
        # Reset and recalculate globally
        unit_stats = {}
        for log in all_logs:
            # Figure out unit_code
            log_uc = log.get("unit_code")
            if not log_uc and log.get("note_id"):
                log_uc = note_to_unit.get(str(log["note_id"]))
            
            if log_uc:
                if log_uc not in unit_stats:
                    unit_stats[log_uc] = {"time_spent": 0, "quizzes": 0, "flashcards": 0}
                
                if log["type"] == "time_spent":
                    unit_stats[log_uc]["time_spent"] += log.get("duration_minutes", 0)
                elif log["type"] == "quiz_completed":
                    unit_stats[log_uc]["quizzes"] += 1
                elif log["type"] == "flashcards_reviewed":
                    unit_stats[log_uc]["flashcards"] += 1

    mastery_context = "STUDENT TELEMETRY / MASTERY (Higher time/quizzes = Better mastery):\n"
    for uc, stats in unit_stats.items():
        mastery_context += f"- Unit: {uc}: {stats['time_spent']} mins studied, {stats['quizzes']} quizzes taken, {stats['flashcards']} flashcard decks reviewed.\n"
    
    materials_context = "STUDY MATERIALS AVAILABLE:\n"
    for uc, titles in notes_by_unit.items():
        materials_context += f"- Unit {uc}: {', '.join(titles)}\n"

    if not exams:
        objective = f"Generate a highly realistic, 4-week study plan starting from TODAY ({today_str}) to build mastery across all units.\nCrucially, you MUST prioritize units with LOW mastery (low time spent, few quizzes)."
    else:
        objective = f"Generate a highly realistic, week-by-week study plan from TODAY ({today_str}) until their exams.\nCrucially, you MUST prioritize units with LOW mastery (low time spent, few quizzes) and IMPENDING exams.\nDO NOT generate study tasks for exams that have already passed (dates before {today_str})."

    prompt = f"""
    You are an expert adaptive academic study planner. 
    A university student needs a dynamic study plan based on their upcoming exams (if any) and their current mastery of the material.
    They can study {hours_per_day} hours per day.
    
    {exam_context}
    
    {mastery_context}
    
    {materials_context}
    
    {objective}
    Include your AI reasoning for the focus of each week.
    
    Return ONLY a valid JSON object with this schema:
    {{
      "exam_date": "Date of earliest exam",
      "total_weeks": 4,
      "advice": "Brief overall advice tailored to their telemetry",
      "weeks": [
        {{
          "week_number": 1,
          "focus_area": "What to focus on this week",
          "reasoning": "Explain why this was prioritized based on their telemetry/exam dates",
          "daily_tasks": [
            {{
              "day": "Monday",
              "task": "Specific study task (e.g. 'Review ICS 2404 Topic 1')",
              "duration_hours": 2
            }}
          ]
        }}
      ]
    }}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        plan_data = json.loads(response.text)
        
        # Save active plan to database
        plan_doc = {
            "user_id": user_obj_id,
            "created_at": datetime.now(timezone.utc),
            "plan_data": plan_data
        }
        # Replace existing active plan
        study_plans_collection.delete_many({"user_id": user_obj_id, "type": "adaptive_plan"})
        plan_doc["type"] = "adaptive_plan"
        study_plans_collection.insert_one(plan_doc)
        
        return plan_data
    except Exception as e:
        raise handle_gemini_error(e)
