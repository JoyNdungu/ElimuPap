import re
from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import Optional
from database import notes_collection, units_collection, quizzes_collection, srs_flashcards_collection
from utils.auth import decode_token
from bson import ObjectId

router = APIRouter(prefix="/api/search", tags=["search"])

def get_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]

@router.get("")
def search_all(q: str = Query(..., min_length=1), authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    q_clean = q.strip()
    if not q_clean:
        return {"notes": [], "units": [], "quizzes": [], "flashcards": []}

    regex = re.compile(re.escape(q_clean), re.IGNORECASE)

    # Search Notes
    notes_cursor = notes_collection.find({
        "$or": [
            {"user_id": user_id},
            {"user_id": {"$exists": False}}
        ],
        "$or": [
            {"title": {"$regex": regex}},
            {"filename": {"$regex": regex}},
            {"topic": {"$regex": regex}},
            {"unit_code": {"$regex": regex}},
            {"extracted_text": {"$regex": regex}}
        ]
    }).limit(10)

    notes = []
    for doc in notes_cursor:
        text = doc.get("extracted_text", "") or ""
        snippet = ""
        match = re.search(re.escape(q_clean), text, re.IGNORECASE)
        if match:
            start = max(0, match.start() - 40)
            end = min(len(text), match.end() + 60)
            snippet = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")
        else:
            snippet = text[:100] + ("..." if len(text) > 100 else "")

        notes.append({
            "id": str(doc["_id"]),
            "title": doc.get("title") or doc.get("filename") or "Untitled Note",
            "topic": doc.get("topic", "General"),
            "unit_code": doc.get("unit_code", ""),
            "snippet": snippet,
            "type": "note"
        })

    # Search Units
    units_cursor = units_collection.find({
        "$or": [
            {"title": {"$regex": regex}},
            {"code": {"$regex": regex}},
            {"description": {"$regex": regex}}
        ]
    }).limit(5)

    units = []
    for doc in units_cursor:
        units.append({
            "id": str(doc["_id"]),
            "code": doc.get("code", ""),
            "title": doc.get("title", ""),
            "type": "unit"
        })

    # Search Quizzes
    quizzes_cursor = quizzes_collection.find({
        "user_id": user_id,
        "$or": [
            {"topic": {"$regex": regex}},
            {"unit_code": {"$regex": regex}}
        ]
    }).limit(5)

    quizzes = []
    for doc in quizzes_cursor:
        quizzes.append({
            "id": str(doc["_id"]),
            "title": doc.get("topic") or "Quiz",
            "unit_code": doc.get("unit_code", ""),
            "type": "quiz"
        })

    # Search Flashcards
    flashcards_cursor = srs_flashcards_collection.find({
        "user_id": user_id,
        "$or": [
            {"front": {"$regex": regex}},
            {"back": {"$regex": regex}},
            {"unit_code": {"$regex": regex}}
        ]
    }).limit(5)

    flashcards = []
    for doc in flashcards_cursor:
        flashcards.append({
            "id": str(doc["_id"]),
            "front": doc.get("front", ""),
            "back": doc.get("back", ""),
            "unit_code": doc.get("unit_code", ""),
            "type": "flashcard"
        })

    return {
        "notes": notes,
        "units": units,
        "quizzes": quizzes,
        "flashcards": flashcards
    }
