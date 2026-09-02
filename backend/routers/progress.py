from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from database import notes_collection, units_collection, db
from utils.auth import decode_token
from bson import ObjectId
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/progress", tags=["Progress"])

# Collections
activity_collection = db["activity_logs"]
views_collection = db["note_views"] # Legacy, keep for backward compatibility

class ActivityRequest(BaseModel):
    type: str # 'note_opened', 'time_spent', 'quiz_completed', 'flashcards_reviewed', 'ai_practice'
    note_id: Optional[str] = None
    unit_code: Optional[str] = None
    duration_minutes: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload.get("sub")

@router.post("/view")
def record_note_view(body: dict, user_id: str = Depends(get_current_user_id)):
    """Legacy endpoint for recording views (kept for compatibility)"""
    note_id = body.get("note_id")
    if not note_id:
        return {"message": "Ignored"}
    # Also log it as a new activity
    activity_collection.insert_one({
        "user_id": ObjectId(user_id),
        "type": "note_opened",
        "note_id": ObjectId(note_id),
        "timestamp": datetime.now(timezone.utc)
    })
    return {"message": "View recorded"}

@router.post("/activity")
def record_activity(req: ActivityRequest, user_id: str = Depends(get_current_user_id)):
    """
    Record an educational activity.
    """
    doc = {
        "user_id": ObjectId(user_id),
        "type": req.type,
        "timestamp": datetime.now(timezone.utc)
    }
    if req.note_id:
        doc["note_id"] = ObjectId(req.note_id)
    if req.unit_code:
        doc["unit_code"] = req.unit_code
    if req.duration_minutes is not None:
        doc["duration_minutes"] = req.duration_minutes
    if req.metadata:
        doc["metadata"] = req.metadata

    activity_collection.insert_one(doc)
    return {"message": "Activity recorded"}

@router.get("/stats")
def get_progress_stats(user_id: str = Depends(get_current_user_id)):
    """
    Return reading progress statistics for the dashboard.
    Now includes Weekly Learning Score and Time Tracker.
    """
    user_obj_id = ObjectId(user_id)
    now = datetime.now(timezone.utc)
    start_of_week = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = start_of_week - timedelta(days=start_of_week.weekday()) # Monday

    # Get all activities for this week
    weekly_activities = list(activity_collection.find({
        "user_id": user_obj_id,
        "timestamp": {"$gte": start_of_week}
    }))

    # Calculate Weekly Score
    # Targets for a 100% week:
    # - 120 mins of reading (15%)
    # - 5 notes opened (5%)
    # - 2 topics studied (20%) (approximated by unique unit_codes accessed)
    # - 2 quizzes taken (25%)
    # - 2 flashcard sessions (15%)
    # - 2 AI practice sessions (20%)
    
    time_spent_mins = sum(a.get("duration_minutes", 0) for a in weekly_activities if a["type"] == "time_spent")
    notes_opened = len(set(str(a.get("note_id")) for a in weekly_activities if a["type"] == "note_opened" and a.get("note_id")))
    units_studied = len(set(a.get("unit_code") for a in weekly_activities if a.get("unit_code")))
    quizzes = len([a for a in weekly_activities if a["type"] == "quiz_completed"])
    flashcards = len([a for a in weekly_activities if a["type"] == "flashcards_reviewed"])
    ai_practice = len([a for a in weekly_activities if a["type"] == "ai_practice"])

    score = 0
    score += min(15, (time_spent_mins / 120) * 15)
    score += min(5, (notes_opened / 5) * 5)
    score += min(20, (units_studied / 2) * 20)
    score += min(25, (quizzes / 2) * 25)
    score += min(15, (flashcards / 2) * 15)
    score += min(20, (ai_practice / 2) * 20)
    
    learning_score = min(100, round(score))

    # Time tracker (by day of week)
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    time_tracker = {day: 0 for day in days}
    for a in weekly_activities:
        if a["type"] == "time_spent":
            day_name = a["timestamp"].strftime("%A")
            time_tracker[day_name] += a.get("duration_minutes", 0)

    # Format time tracker array
    weekly_time_data = [{"day": day, "minutes": time_tracker[day]} for day in days]
    total_weekly_minutes = sum(time_tracker.values())

    # Lifetime stats
    total_notes_opened = len(activity_collection.distinct("note_id", {"user_id": user_obj_id, "type": "note_opened"}))
    total_practice_qs = activity_collection.count_documents({"user_id": user_obj_id, "type": "quiz_completed"}) * 5 # Approx 5 per quiz
    total_flashcards = activity_collection.count_documents({"user_id": user_obj_id, "type": "flashcards_reviewed"}) * 10 # Approx 10 per deck

    # Topics studied (total units)
    total_units = units_collection.count_documents({"user_id": user_obj_id})
    studied_units = len(activity_collection.distinct("unit_code", {"user_id": user_obj_id}))

    return {
        "learning_score": learning_score,
        "history": {
            "notes_opened": total_notes_opened,
            "topics_studied": f"{studied_units}/{total_units}",
            "practice_questions": total_practice_qs,
            "flashcards_reviewed": total_flashcards
        },
        "time_tracker": {
            "daily": weekly_time_data,
            "total_minutes": total_weekly_minutes
        },
        # Keep legacy fields so dashboard doesn't crash before UI update
        "reading_progress": learning_score, 
    }
