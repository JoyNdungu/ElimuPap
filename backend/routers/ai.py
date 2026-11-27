import os
import shutil
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from database import (
    notes_collection, summaries_collection, tutor_conversations_collection,
    exams_collection, study_plans_collection, units_collection,
    srs_flashcards_collection, past_papers_collection, study_sessions_collection, db
)
from bson import ObjectId
from utils.auth import decode_token
from fastapi.security import OAuth2PasswordBearer
from openai import OpenAI
import json
import base64
from fastapi import File, Form, UploadFile
from pydantic import BaseModel, Field

class Definition(BaseModel):
    term: str
    definition: str

class SummaryResponse(BaseModel):
    title: str
    summary: str
    key_points: List[str]
    definitions: List[Definition]

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardsResponse(BaseModel):
    flashcards: List[Flashcard]

class MindMapBranch(BaseModel):
    label: str
    children: List[str]

class MindMapResponse(BaseModel):
    root: str
    branches: List[MindMapBranch]

router = APIRouter(prefix="/ai", tags=["AI Features"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user_id(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload.get("sub")

def handle_gemini_error(e: Exception) -> HTTPException:
    error_msg = str(e)
    print(f"AI ERROR: {error_msg}")
    lower_err = error_msg.lower()
    if (
        "429" in error_msg
        or "413" in error_msg
        or "resource_exhausted" in lower_err
        or "rate_limit_exceeded" in lower_err
        or "tokens per minute" in lower_err
        or "limit 8000" in lower_err
        or "request too large" in lower_err
    ):
        return HTTPException(
            status_code=429,
            detail="AI token burst limit reached for this minute (Groq free tier: 8,000 tokens/min). Please wait 20-30 seconds for your quota to refresh and try again!"
        )
    return HTTPException(status_code=500, detail=f"An error occurred with the AI service: {error_msg}")

def format_stream_error(e: Exception) -> str:
    error_msg = str(e)
    lower_err = error_msg.lower()
    if (
        "429" in error_msg
        or "413" in error_msg
        or "resource_exhausted" in lower_err
        or "rate_limit_exceeded" in lower_err
        or "tokens per minute" in lower_err
        or "limit 8000" in lower_err
        or "request too large" in lower_err
    ):
        return "Error: AI token quota limit reached for this minute on Groq. Please wait 20-30 seconds and try again."
    return "Error: An issue occurred while communicating with the AI."

from dotenv import load_dotenv
load_dotenv(override=True)

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
_DEPRECATED_VISION_MODELS = {"llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"}
_raw_vision_model = (os.getenv("GROQ_VISION_MODEL") or "").strip()
VISION_MODEL = (
    "meta-llama/llama-4-scout-17b-16e-instruct"
    if not _raw_vision_model or _raw_vision_model in _DEPRECATED_VISION_MODELS
    else _raw_vision_model
)

# Initialize Grok and OpenAI Clients
def get_grok_client():
    load_dotenv(override=True)
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Groq API Key is not configured properly.")
    return OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
        timeout=25.0,
        max_retries=1,
    )

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        raise HTTPException(status_code=500, detail="OpenAI API Key is not configured properly.")
    return OpenAI(api_key=api_key)

def prepare_note_text_for_ai(text: str, max_chars: int = 7500) -> str:
    """
    Ensure extracted text fits comfortably within Groq Free Tier TPM limits (< 2,000 tokens).
    If text exceeds max_chars:
      - If it has slide markers ('Slide 1:', 'Slide 2:'), proportionally sample each slide so every slide is represented.
      - Otherwise, preserve the introduction, a sample of the core body, and the conclusion.
    """
    text = (text or "").strip()
    if not text or len(text) <= max_chars:
        return text

    # If it's a presentation with slide blocks:
    if "Slide " in text:
        slides = [s.strip() for s in text.split("\n\n") if s.strip()]
        if len(slides) > 1:
            per_slide_chars = max(80, max_chars // len(slides))
            sampled_slides = []
            for s in slides:
                if len(s) > per_slide_chars:
                    lines = s.split("\n")
                    title = lines[0] if lines else ""
                    body = "\n".join(lines[1:])
                    avail = max(30, per_slide_chars - len(title) - 8)
                    truncated_body = body[:avail].rsplit(" ", 1)[0] if " " in body[:avail] else body[:avail]
                    sampled_slides.append(f"{title}\n{truncated_body}...")
                else:
                    sampled_slides.append(s)
            res = "\n\n".join(sampled_slides)
            if len(res) > max_chars:
                return res[:max_chars]
            return res

    # For standard text documents: take first 60%, sample middle 20%, and final 20%
    head_size = int(max_chars * 0.6)
    tail_size = int(max_chars * 0.3)
    return (
        text[:head_size]
        + "\n\n[... content condensed for token length ...]\n\n"
        + text[-tail_size:]
    )

def execute_groq_completion(client, messages, response_format=None, max_tokens=1400, model=None, reasoning_effort="low", temperature=0.2):
    """
    Executes Groq chat completion with strict max_tokens reservation, low-temperature
    factual grounding, and automatic self-healing retry on 413 / 429 / rate_limit_exceeded errors.
    """
    import time
    target_model = model or DEFAULT_MODEL
    kwargs = {
        "model": target_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    if reasoning_effort and "gpt-oss" in target_model:
        kwargs["reasoning_effort"] = reasoning_effort

    try:
        return client.chat.completions.create(**kwargs)
    except Exception as e:
        err_str = str(e).lower()
        if (
            "413" in err_str
            or "429" in err_str
            or "rate_limit_exceeded" in err_str
            or "tokens per minute" in err_str
            or "limit 8000" in err_str
            or "request too large" in err_str
        ):
            print(f"[ai] Token rate limit encountered ({e}). Pausing 3s and retrying with reduced token footprint...")
            time.sleep(3.0)
            # Self-heal: aggressively condense input messages and drop max_tokens
            shrunk_messages = []
            for m in messages:
                content = m.get("content", "")
                if isinstance(content, str) and len(content) > 3500:
                    content = content[:3500] + "\n\n[... condensed to fit token quota ...]"
                shrunk_messages.append({"role": m["role"], "content": content})
            kwargs["messages"] = shrunk_messages
            kwargs["max_tokens"] = min(max_tokens, 800)
            return client.chat.completions.create(**kwargs)
        raise e

class MessageData(BaseModel):
    role: str
    content: str

class TutorRequest(BaseModel):
    note_id: Optional[str] = None
    messages: List[MessageData]
    mode: Optional[str] = "tutor" # "tutor", "exam_drill", "simple_analogy", "quiz"

class GenerateRequest(BaseModel):
    note_id: str
    force_refresh: bool = False

class QuizRequest(BaseModel):
    note_id: str
    quiz_type: str = "multiple_choice" # "multiple_choice", "text_answer", "combination"
    num_questions: int = 5

def classify_study_relevance(text: str, client=None) -> tuple[bool, str]:
    """
    Determine whether an audio transcript or note contains academic/study material
    rather than accidental recording, silence, mic-test chatter, or off-topic casual speech.
    Fails open (True) on transient API errors so real lectures are never wrongly blocked.
    """
    clean = (text or "").strip()
    placeholder = "Audio lecture recorded. You can listen to the original audio recording using the player above."
    if not clean or clean == placeholder:
        return False, "No spoken study content or transcript was detected in this recording."

    words = [w for w in clean.split() if any(ch.isalnum() for ch in w)]
    if len(words) < 4:
        return False, "The recording is too short or accidental to contain study material."

    try:
        active_client = client or get_grok_client()
        prompt = (
            "Classify whether the following audio transcript is educational, academic, "
            "or study-related (lecture, tutorial, concepts, definitions, exam prep, student notes), "
            "OR whether it is non-study / accidental audio (mic testing like 'testing 123', "
            "casual greetings or daily chit-chat, meal/social talk, background noise, or gibberish).\n\n"
            f"Transcript:\n{clean[:1500]}\n\n"
            'Return ONLY strict JSON: {"is_study_related": true or false, "reason": "brief 1-sentence reason"}'
        )
        res = execute_groq_completion(
            client=active_client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=120,
            temperature=0.0,
        )
        parsed = json.loads(res.choices[0].message.content)
        is_study = bool(parsed.get("is_study_related", True))
        reason = (parsed.get("reason") or "").strip()
        return is_study, reason
    except Exception as e:
        print(f"[ai] study relevance check skipped: {e}")
        return True, ""


def ensure_study_related_note(note: dict, client=None):
    """Raise HTTP 400 if a recorded note is flagged as non-study / accidental content."""
    if note.get("is_study_related") is False:
        reason = note.get("study_relevance_reason") or "This recording does not appear to contain academic or study material."
        raise HTTPException(
            status_code=400,
            detail=f"Not study-related: {reason} Please record or upload study material, or delete this accidental recording."
        )

    if note.get("file_type") == "audio_lecture" and "is_study_related" not in note:
        is_study, reason = classify_study_relevance(note.get("extracted_text", ""), client=client)
        try:
            notes_collection.update_one(
                {"_id": note["_id"]},
                {"$set": {"is_study_related": is_study, "study_relevance_reason": reason}},
            )
        except Exception:
            pass
        if not is_study:
            raise HTTPException(
                status_code=400,
                detail=f"Not study-related: {reason or 'This recording does not appear to contain study material.'} Please delete this accidental recording or record lecture content."
            )


def get_note_text(note: dict) -> str:
    """
    Return the best available text for a note.
    Order of preference:
      1. extracted_text already in DB
      2. On-the-fly re-extraction from file on disk (for old notes)
      3. Rich fallback using title/unit/topic so Gemini can still generate useful content
    """
    text = note.get("extracted_text", "").strip()

    # Skip sentinel value set during background extraction
    if text == "__EXTRACTING__":
        text = ""

    # On-the-fly retry for notes that have a file but empty text
    if not text and note.get("file_path"):
        import os, sys, subprocess
        file_path = note["file_path"]
        ext = note.get("file_type", "")
        if os.path.exists(file_path):
            try:
                # Import extraction helper from notes router
                from routers.notes import extract_text_from_file
                text = extract_text_from_file(file_path, ext)
                if text:
                    # Persist so next call is instant
                    notes_collection.update_one(
                        {"_id": note["_id"]},
                        {"$set": {"extracted_text": text, "extraction_status": "done"}}
                    )
            except Exception as e:
                print(f"[ai] on-the-fly extraction failed: {e}")

    # Fallback: give Gemini enough context to generate useful study material
    if not text:
        title  = note.get("title", "Untitled")
        unit   = note.get("unit_code", "")
        topic  = note.get("topic", "")
        text = (
            f"Topic: {title}\n"
            f"Unit: {unit}\n"
            f"Subject area: {topic}\n\n"
            "Note: The document text could not be extracted. "
            "Please generate educational content based on the topic name and unit above. "
            "Draw on your general knowledge of this subject to create high-quality study material."
        )

    return text

@router.post("/tutor")
async def tutor_chat(req: TutorRequest, user_id: str = Depends(get_current_user_id)):
    client = get_grok_client()
    
    # Retrieve context if note_id is provided
    context_text = ""
    unit_label = ""
    missing_note_text_reason = ""
    if req.note_id:
        user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
        try:
            note = notes_collection.find_one({"_id": ObjectId(req.note_id), **user_query}) or notes_collection.find_one({"_id": ObjectId(req.note_id)})
            if note:
                if note.get("is_study_related") is False:
                    reason = note.get("study_relevance_reason") or "it was detected as accidental or casual non-study audio"
                    missing_note_text_reason = (
                        f"The selected recording '{note.get('title', 'Selected Note')}' is NOT study-related ({reason})."
                    )
                else:
                    raw_txt = (note.get("extracted_text") or "").strip()
                    if raw_txt and raw_txt != "__EXTRACTING__":
                        if note.get("file_type") == "audio_lecture" and "is_study_related" not in note:
                            is_study, reason = classify_study_relevance(raw_txt, client=client)
                            try:
                                notes_collection.update_one(
                                    {"_id": note["_id"]},
                                    {"$set": {"is_study_related": is_study, "study_relevance_reason": reason}},
                                )
                            except Exception:
                                pass
                            if not is_study:
                                missing_note_text_reason = (
                                    f"The selected recording '{note.get('title', 'Selected Note')}' is NOT study-related ({reason or 'casual or accidental audio'})."
                                )
                        if not missing_note_text_reason:
                            unit_label = f"Unit: {note.get('unit_code', 'General')} | Topic: {note.get('title', 'Study Notes')}"
                            trimmed = prepare_note_text_for_ai(raw_txt, max_chars=3500)
                            context_text = f"--- ACTIVE COURSE MATERIAL ({unit_label}) ---\n{trimmed}\n---\n\n"
                    else:
                        missing_note_text_reason = f"The note '{note.get('title', 'Selected Note')}' does not have extracted text available yet."
        except Exception:
            pass

    # Mode-specific persona directions
    mode_instructions = {
        "exam_drill": (
            "🎯 MODE: EXAM DRILL & PAST PAPER PREP.\n"
            "Focus like a top university examiner. Emphasize:\n"
            "1. Core marking scheme keywords that earn maximum marks.\n"
            "2. Common student traps & misconception pitfalls.\n"
            "3. Structured answer templates (Definition -> Theory -> Application).\n"
            "Always conclude with an authentic '📝 **Exam Practice Question:**' for the student to solve!"
        ),
        "simple_analogy": (
            "💡 MODE: ELI5 & REAL-WORLD ANALOGIES.\n"
            "Explain this topic in vivid, memorable, everyday terms. Use vibrant analogies (campus life, matatus, smartphones, marketplace trades, etc.). "
            "Demystify complex jargon so anyone understands in 60 seconds.\n"
            "Always conclude with: '🤔 **Does that click?**' and ask a quick mini-challenge."
        ),
        "quiz": (
            "🎮 MODE: RAPID-FIRE POP QUIZ.\n"
            "Act as an energetic quiz master!\n"
            "Ask exactly ONE high-yield multiple-choice question at a time with 4 labeled options: A, B, C, D.\n"
            "If the student answered a previous question, evaluate their answer with enthusiasm ('🎉 Spot on!' or '💡 Close, here is the nuance...'), briefly explain why, and drop the next question!"
        ),
        "tutor": (
            "⚡ MODE: INTERACTIVE ACADEMIC MENTOR.\n"
            "You are ElimuPap's AI Study Mentor — energetic, intellectually curious, encouraging, and clear.\n"
            "Make explanations structured and exciting! Use:\n"
            "• **The Core Idea** (concise 1-2 sentence hook)\n"
            "• **Key Mechanisms / Steps** (clean bullet points with bold terms)\n"
            "• **💡 High-Yield Takeaway / Real Example**\n"
            "Always finish with a stimulating follow-up question or micro-challenge to keep the student actively engaged."
        )
    }

    mode_text = mode_instructions.get(req.mode, mode_instructions["tutor"])

    grounding_rules = (
        "STRICT GROUNDING RULES:\n"
        "- Base your explanations, examples, analogies, exam questions, and answers STRICTLY on the ACTIVE COURSE MATERIAL below.\n"
        "- Do NOT fabricate syllabus facts, formulas, definitions, or course details not supported by the material. If something is missing from the notes, state that clearly.\n"
        "- If the loaded material itself is clearly casual non-study chatter, mic-testing, or accidental speech rather than academic content, inform the student clearly that the recording does not appear to be study-related instead of inventing a lesson.\n"
        if context_text
        else (
            "STRICT ANTI-HALLUCINATION RULES (NO STUDY NOTES LOADED):\n"
            f"- {missing_note_text_reason or 'No study note is currently loaded for this chat.'}\n"
            "- If the selected recording was flagged as NOT study-related, tell the student directly that this recording does not appear to be study-related and suggest deleting it or recording actual lecture material.\n"
            "- NEVER invent, assume, or hallucinate a random course, unit, or topic when the student has not explicitly named a specific subject.\n"
            "- If the student sends a generic request (such as 'simple analogy', 'quiz me', 'crash course', or 'explain this') without naming a specific concept or topic, DO NOT make up a subject. Politely inform them that no notes are loaded yet and ask them to upload/select a note or state the exact topic they want to learn.\n"
            "- Only answer directly if the student clearly named a specific topic or asked a self-contained question.\n"
        )
    )

    system_content = (
        "You are the ElimuPap AI Academic Tutor, an expert university study companion designed for Kenyan university students.\n"
        f"{mode_text}\n"
        f"{grounding_rules}"
        "GUIDELINES:\n"
        "- Never write giant, unformatted walls of gray text.\n"
        "- Use clean Markdown (bold terms, bullet points, numbered lists, blockquotes).\n"
        "- Keep responses punchy, engaging, and readable (~250-400 words) so students stay energized.\n"
        f"{context_text}"
    )

    messages = [{"role": "system", "content": system_content}]

    recent_messages = req.messages[-8:] if len(req.messages) > 8 else req.messages
    for msg in recent_messages:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})

    # Return a StreamingResponse with max_tokens cap
    def stream_generator():
        try:
            response_stream = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=messages,
                stream=True,
                max_tokens=850,
                temperature=0.25
            )
            for chunk in response_stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield format_stream_error(e)

    return StreamingResponse(stream_generator(), media_type="text/plain")


class TutorConversationMessage(BaseModel):
    id: Optional[str] = None
    role: str
    content: str


class TutorConversationUpsert(BaseModel):
    id: str
    title: Optional[str] = "Tutor Session"
    note_id: Optional[str] = None
    note_title: Optional[str] = None
    unit_code: Optional[str] = None
    mode: Optional[str] = "tutor"
    messages: List[TutorConversationMessage]


@router.get("/tutor/conversations")
def list_tutor_conversations(user_id: str = Depends(get_current_user_id)):
    """Return the user's saved AI tutor conversations sorted most-recent first."""
    docs = list(
        tutor_conversations_collection
        .find({"user_id": user_id})
        .sort("updated_at", -1)
        .limit(40)
    )
    results = []
    for d in docs:
        updated_at = d.get("updated_at")
        updated_iso = (
            updated_at.isoformat() if isinstance(updated_at, datetime)
            else str(updated_at or "")
        )
        results.append({
            "id": d.get("client_id") or str(d["_id"]),
            "title": d.get("title") or "Tutor Session",
            "note_id": d.get("note_id"),
            "note_title": d.get("note_title"),
            "unit_code": d.get("unit_code"),
            "mode": d.get("mode") or "tutor",
            "messages": d.get("messages") or [],
            "updated_at": updated_iso,
        })
    return results


@router.post("/tutor/conversations")
def save_tutor_conversation(
    payload: TutorConversationUpsert,
    user_id: str = Depends(get_current_user_id)
):
    """Create or update a saved AI tutor conversation in MongoDB."""
    now = datetime.now(timezone.utc)
    clean_messages = [
        {"id": m.id or str(idx), "role": m.role, "content": m.content}
        for idx, m in enumerate(payload.messages)
        if m.content and m.content.strip()
    ]
    if not clean_messages:
        return {"id": payload.id, "saved": False}

    # Auto-derive a concise title from the first user prompt if none given
    derived_title = (payload.title or "").strip()
    if not derived_title or derived_title == "Tutor Session":
        first_user = next((m["content"] for m in clean_messages if m["role"] == "user"), "")
        if first_user:
            derived_title = first_user[:55] + ("…" if len(first_user) > 55 else "")
        elif payload.note_title:
            derived_title = payload.note_title[:55]
        else:
            derived_title = "Tutor Session"

    tutor_conversations_collection.update_one(
        {"user_id": user_id, "client_id": payload.id},
        {
            "$set": {
                "user_id": user_id,
                "client_id": payload.id,
                "title": derived_title,
                "note_id": payload.note_id,
                "note_title": payload.note_title,
                "unit_code": payload.unit_code,
                "mode": payload.mode or "tutor",
                "messages": clean_messages,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {
        "id": payload.id,
        "title": derived_title,
        "updated_at": now.isoformat(),
        "saved": True,
    }


@router.delete("/tutor/conversations/{conv_id}")
def delete_tutor_conversation(conv_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a saved tutor conversation for the current user."""
    query = {"$or": [{"client_id": conv_id}]}
    if ObjectId.is_valid(conv_id):
        query["$or"].append({"_id": ObjectId(conv_id)})
    res = tutor_conversations_collection.delete_one({"user_id": user_id, **query})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "id": conv_id}

def build_and_cache_summary(note: dict, user_id: str) -> dict:
    """Synchronously generate a structured summary for a note and persist it in MongoDB."""
    client = get_grok_client()
    raw_note_text = get_note_text(note)
    # Tighter token budget keeps first-time generation fast on Groq
    note_text = prepare_note_text_for_ai(raw_note_text, max_chars=5000)
    file_type = note.get("file_type", "")
    is_presentation = file_type in ("pptx", "ppt") or "Slide" in raw_note_text[:400]

    doc_context = (
        "This is a lecture slide deck. Group slides into 3-5 logical modules with clear exam takeaways."
        if is_presentation
        else "This is an academic study document. Provide a crisp executive summary with 3-5 core thematic sections."
    )

    prompt = f"""
    Synthesize a crisp, high-yield study summary for a university student.
    {doc_context}
    
    Return strictly a JSON object with this schema (keep all text concise and punchy):
    {{
      "title": "Clear academic title",
      "doc_type": "{"Presentation Deck" if is_presentation else "Lecture Note"}",
      "deck_overview": "2-sentence executive summary.",
      "summary": "Cohesive 1-2 paragraph conceptual breakdown.",
      "key_points": [
        "Primary high-yield point (4-5 items total)"
      ],
      "sections": [
        {{
          "section_title": "Section / Module Name",
          "slide_range": "Part 1 (Slides 1-5)",
          "summary": "Concise 2-sentence explanation of this module.",
          "key_takeaways": ["Takeaway 1", "Takeaway 2"],
          "highlight": "Essential formula, rule, or concept"
        }}
      ],
      "exam_highlights": [
        "High-probability exam topic or distinction (2-3 items)"
      ],
      "definitions": [
        {{"term": "Crucial Term", "definition": "Direct 1-sentence definition (4-6 items)"}}
      ],
      "quick_quiz": [
        "Self-check question (2-3 items)"
      ]
    }}
    
    Notes:
    {note_text}
    """

    response = execute_groq_completion(
        client=client,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=1100,
        reasoning_effort="low"
    )
    summary_data = json.loads(response.choices[0].message.content)
    note_id_str = str(note["_id"])

    summaries_collection.update_one(
        {"note_id": note_id_str, "user_id": user_id},
        {
            "$set": {
                "note_id": note_id_str,
                "user_id": user_id,
                "summary_data": summary_data,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    return summary_data


@router.post("/summary")
async def generate_summary(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    # 1. Return cached summary immediately if available (unless force_refresh is requested)
    if not req.force_refresh:
        cached = summaries_collection.find_one({"note_id": req.note_id, "user_id": user_id})
        if cached and cached.get("summary_data"):
            return cached["summary_data"]

    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), **user_query})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    ensure_study_related_note(note)

    try:
        return build_and_cache_summary(note, user_id)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/quiz")
async def generate_quiz(req: QuizRequest, user_id: str = Depends(get_current_user_id)):
    client = get_grok_client()
    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), **user_query})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    ensure_study_related_note(note, client=client)

    raw_note_text = get_note_text(note)
    note_text = prepare_note_text_for_ai(raw_note_text, max_chars=6000)

    quiz_instructions = ""
    if req.quiz_type == "multiple_choice":
        quiz_instructions = "Generate all multiple choice questions."
    elif req.quiz_type == "text_answer":
        quiz_instructions = "Generate all text-answer questions (where the user types in their response)."
    else:
        quiz_instructions = "Generate a balanced combination of multiple-choice and text-answer questions."

    prompt = f"""
    Generate a {req.num_questions}-question quiz strictly grounded in the following notes.
    {quiz_instructions}

    ACCURACY & GROUNDING REQUIREMENTS:
    - Every question, answer, and distractor must be directly supported by the provided notes. Do NOT invent facts outside the notes.
    - Ensure each question has one unambiguous correct answer. For multiple_choice, "correct_answer" MUST match one exact entry in "options".
    - In every "explanation", briefly cite the supporting fact, definition, or slide/section from the notes (e.g., "Based on Slide 3 / the notes: ...").

    Return ONLY a valid JSON object with the following schema:
    {{
      "quiz_title": "Quiz Title",
      "questions": [
        {{
          "type": "multiple_choice",
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correct_answer": "Option 1",
          "explanation": "Why Option 1 is correct, citing the supporting fact or slide/section from the notes"
        }},
        {{
          "type": "text_answer",
          "question": "Question text",
          "options": [],
          "correct_answer": "The expected key points or short ideal answer",
          "explanation": "Detailed explanation citing the supporting fact or slide/section from the notes"
        }}
      ]
    }}
    For text_answer types, you MUST include an empty "options" array.
    
    Notes:
    {note_text}
    """
    
    try:
        response = execute_groq_completion(
            client=client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1200,
            temperature=0.2
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise handle_gemini_error(e)

class StudyPlanRequest(BaseModel):
    exam_date: str          # ISO date string e.g. "2026-11-15"
    hours_per_day: Optional[int] = 3

@router.post("/flashcards")
async def generate_flashcards(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    """Generate 10 Q&A flashcards from a note."""
    client = get_grok_client()
    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), **user_query})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    ensure_study_related_note(note, client=client)

    raw_note_text = get_note_text(note)
    note_text = prepare_note_text_for_ai(raw_note_text, max_chars=5000)

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
        response = execute_groq_completion(
            client=client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1000
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/mindmap")
async def generate_mindmap(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    """Generate a mind map (nested concept tree) from a note."""
    client = get_grok_client()
    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    note = notes_collection.find_one({"_id": ObjectId(req.note_id), **user_query})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    ensure_study_related_note(note, client=client)

    raw_note_text = get_note_text(note)
    note_text = prepare_note_text_for_ai(raw_note_text, max_chars=5000)

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
        response = execute_groq_completion(
            client=client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1000
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise handle_gemini_error(e)

@router.post("/study-plan")
async def generate_study_plan(
    hours_per_day: int = Form(3),
    authorization: str = Depends(oauth2_scheme)
):
    """Generate an adaptive AI study plan based on telemetry and exams."""
    user_id = get_current_user_id(authorization)
    client = get_grok_client()
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
        response = execute_groq_completion(
            client=client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1400
        )
        plan_data = json.loads(response.choices[0].message.content)
        
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


# ============================================================================
# FEATURE 2: Spaced Repetition Flashcards (SM-2 Algorithm)
# ============================================================================
class SRSReviewRequest(BaseModel):
    card_id: str
    rating: int # 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

@router.get("/srs/due")
def get_due_srs_flashcards(token: str = Depends(oauth2_scheme)):
    user_id = get_current_user_id(token)
    user_obj_id = ObjectId(user_id)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    cards = list(srs_flashcards_collection.find({
        "user_id": user_obj_id,
        "next_review_date": {"$lte": today_str}
    }).limit(20))

    # If no existing cards due, generate initial cards from recent user notes
    if not cards:
        recent_notes = list(notes_collection.find({"user_id": user_id}).limit(3))
        if recent_notes:
            note_content = "\n\n".join([n.get("extracted_text", "")[:500] for n in recent_notes if n.get("extracted_text")])
            if note_content.strip():
                try:
                    client = get_grok_client()
                    prompt = f"""Generate 5 high-quality flashcards (question and answer) for studying based on these notes:\n{note_content}\nReturn strictly JSON: {{"flashcards": [{{"front": "Q", "back": "A"}}]}}"""
                    res = execute_groq_completion(
                        client=client,
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        max_tokens=600
                    )
                    parsed = json.loads(res.choices[0].message.content)
                    for fc in parsed.get("flashcards", []):
                        doc = {
                            "user_id": user_obj_id,
                            "front": fc["front"],
                            "back": fc["back"],
                            "unit_code": recent_notes[0].get("unit_code", "GEN"),
                            "repetitions": 0,
                            "interval": 1,
                            "ease_factor": 2.5,
                            "next_review_date": today_str,
                            "last_reviewed": None
                        }
                        srs_flashcards_collection.insert_one(doc)
                    cards = list(srs_flashcards_collection.find({"user_id": user_obj_id, "next_review_date": {"$lte": today_str}}).limit(20))
                except Exception:
                    pass

    output = []
    for c in cards:
        c["id"] = str(c["_id"])
        del c["_id"]
        del c["user_id"]
        output.append(c)
    return output

@router.post("/srs/review")
def review_srs_flashcard(req: SRSReviewRequest, token: str = Depends(oauth2_scheme)):
    user_id = get_current_user_id(token)
    user_obj_id = ObjectId(user_id)
    card = srs_flashcards_collection.find_one({"_id": ObjectId(req.card_id), "user_id": user_obj_id})
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    q = max(1, min(4, req.rating))
    # Map 1..4 rating to SM-2 quality 0..5: 1->1, 2->3, 3->4, 4->5
    q_sm2 = {1: 1, 2: 3, 3: 4, 4: 5}[q]

    reps = card.get("repetitions", 0)
    interval = card.get("interval", 1)
    ef = card.get("ease_factor", 2.5)

    if q_sm2 >= 3:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = int(round(interval * ef))
        reps += 1
    else:
        reps = 0
        interval = 1

    ef = ef + (0.1 - (5 - q_sm2) * (0.08 + (5 - q_sm2) * 0.02))
    if ef < 1.3:
        ef = 1.3

    next_date = (datetime.now(timezone.utc) + timedelta(days=interval)).strftime("%Y-%m-%d")

    srs_flashcards_collection.update_one(
        {"_id": ObjectId(req.card_id)},
        {"$set": {
            "repetitions": reps,
            "interval": interval,
            "ease_factor": round(ef, 2),
            "next_review_date": next_date,
            "last_reviewed": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }}
    )
    return {"message": "Card reviewed", "next_review_date": next_date, "interval": interval}


# ============================================================================
# FEATURE 7: Handwriting / Photo OCR (Scan Note to Markdown)
# ============================================================================
@router.post("/ocr")
async def ocr_scanned_note(
    file: UploadFile = File(...),
    title: Optional[str] = Form("Scanned Handwritten Note"),
    unit_code: Optional[str] = Form("GENERAL"),
    token: str = Depends(oauth2_scheme)
):
    user_id = get_current_user_id(token)
    os.makedirs("uploads/ocr", exist_ok=True)
    file_path = os.path.join("uploads/ocr", f"{user_id}_{file.filename}")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        client = get_grok_client()
        with open(file_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
        prompt = """
        Transcribe all text from this handwritten or printed note image accurately.
        Format the extracted text as clear, professional Markdown with headings, bullet points, definitions, and code/formulas where appropriate.
        Return ONLY the Markdown document text.
        """

        res = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1200
        )
        extracted_text = res.choices[0].message.content or "No text could be extracted from this image."

        # Create note record
        note_doc = {
            "user_id": user_id,
            "title": title or "Scanned Note",
            "unit_code": unit_code or "GENERAL",
            "filename": file.filename,
            "file_url": f"/uploads/ocr/{os.path.basename(file_path)}",
            "extracted_text": extracted_text,
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "file_type": "ocr_image"
        }
        res_db = notes_collection.insert_one(note_doc)
        note_doc["id"] = str(res_db.inserted_id)
        del note_doc["_id"]

        return note_doc
    except Exception as e:
        raise handle_gemini_error(e)
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


# ============================================================================
# FEATURE 8: Audio Lecture Transcriber & Summarizer
# ============================================================================
@router.post("/transcribe-chunk")
async def transcribe_audio_chunk(
    file: UploadFile = File(...),
    token: str = Depends(oauth2_scheme)
):
    """Lightweight live-transcription endpoint used while recording when browser STT is unavailable."""
    get_current_user_id(token)
    try:
        audio_bytes = await file.read()
        if not audio_bytes or len(audio_bytes) < 500:
            return {"text": ""}
        client = get_grok_client()
        transcription = client.audio.transcriptions.create(
            file=(file.filename or "chunk.webm", audio_bytes),
            model="whisper-large-v3"
        )
        text = (getattr(transcription, "text", "") or "").strip()
        return {"text": text}
    except Exception as e:
        print(f"Live chunk transcription notice: {e}")
        return {"text": ""}


@router.post("/transcribe-audio")
async def transcribe_lecture_audio(
    file: UploadFile = File(...),
    title: Optional[str] = Form("Lecture Recording"),
    unit_code: Optional[str] = Form("GENERAL"),
    live_transcript: Optional[str] = Form(""),
    token: str = Depends(oauth2_scheme)
):
    user_id = get_current_user_id(token)
    os.makedirs("uploads/audio", exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    clean_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join("uploads/audio", clean_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save audio file: {e}")
    finally:
        file.file.close()

    # Attempt transcription using Groq Whisper model, falling back to live Speech-to-Text notes
    extracted_text = ""
    client = None
    try:
        client = get_grok_client()
        with open(file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(clean_filename, audio_file.read()),
                model="whisper-large-v3"
            )
            extracted_text = getattr(transcription, "text", str(transcription)) or ""
    except Exception as e:
        print(f"Audio transcription note: {e}")
        extracted_text = ""

    if not extracted_text.strip():
        extracted_text = (
            (live_transcript or "").strip()
            or "Audio lecture recorded. You can listen to the original audio recording using the player above."
        )

    is_study_related, study_relevance_reason = classify_study_relevance(extracted_text, client=client)

    # Create note record in MongoDB
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    note_doc = {
        "user_id": user_obj_id,
        "title": title or "Recorded Audio Lecture",
        "unit_code": (unit_code or "GENERAL").strip().upper(),
        "filename": file.filename,
        "safe_filename": clean_filename,
        "file_url": f"/uploads/audio/{clean_filename}",
        "file_path": file_path,
        "extracted_text": extracted_text,
        "is_study_related": is_study_related,
        "study_relevance_reason": study_relevance_reason,
        "created_at": datetime.utcnow(),
        "file_type": "audio_lecture"
    }

    try:
        res_db = notes_collection.insert_one(note_doc)
        note_doc["id"] = str(res_db.inserted_id)
        if "_id" in note_doc:
            del note_doc["_id"]
        if isinstance(note_doc.get("user_id"), ObjectId):
            note_doc["user_id"] = str(note_doc["user_id"])
        if isinstance(note_doc.get("created_at"), datetime):
            note_doc["created_at"] = note_doc["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        return note_doc
    except Exception as e:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Database error saving note: {e}")


# ============================================================================
# FEATURE 11: Knowledge Graph & Concept Connections
# ============================================================================
@router.get("/knowledge-graph")
def get_knowledge_graph(token: str = Depends(oauth2_scheme)):
    user_id = get_current_user_id(token)
    user_notes = list(notes_collection.find({"user_id": user_id}))

    if not user_notes:
        return {"nodes": [], "edges": []}

    summaries = []
    for n in user_notes[:10]:
        t = n.get("title") or n.get("filename") or "Untitled"
        code = n.get("unit_code", "GEN")
        txt = (n.get("extracted_text") or "")[:400]
        summaries.append(f"Note ID '{str(n['_id'])}' (Unit: {code}, Title: {t}): {txt}")

    client = get_grok_client()

    prompt = f"""
    Analyze these study notes and construct a Knowledge Graph connecting key concepts across units/topics.
    Notes:
    {"\n---\n".join(summaries)}

    Return strictly JSON with schema:
    {{
      "nodes": [
        {{"id": "c1", "label": "Concept Name", "unit_code": "ICS 2101", "type": "concept"}},
        {{"id": "n1", "label": "Note Title", "unit_code": "ICS 2101", "type": "note"}}
      ],
      "edges": [
        {{"source": "n1", "target": "c1", "relation": "covers"}},
        {{"source": "c1", "target": "c2", "relation": "prerequisite"}}
      ]
    }}
    """

    try:
        res = execute_groq_completion(
            client=client,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1000
        )
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        # Fallback simple graph
        nodes = []
        edges = []
        for idx, n in enumerate(user_notes):
            nid = str(n["_id"])
            lbl = n.get("title") or n.get("filename") or f"Note {idx+1}"
            nodes.append({"id": nid, "label": lbl, "unit_code": n.get("unit_code", "GEN"), "type": "note"})
        return {"nodes": nodes, "edges": edges}


# ============================================================================
# FEATURE 5: Past Paper Question Bank & Parser
# ============================================================================
@router.post("/past-papers/extract")
async def extract_past_paper(
    file: UploadFile = File(...),
    unit_code: Optional[str] = Form("GENERAL"),
    year: Optional[str] = Form("2024"),
    token: str = Depends(oauth2_scheme)
):
    user_id = get_current_user_id(token)
    user_obj_id = ObjectId(user_id)
    os.makedirs("uploads/past_papers", exist_ok=True)
    file_path = os.path.join("uploads/past_papers", f"{user_id}_{file.filename}")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        client = get_grok_client()
        with open(file_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
        prompt = f"""
        This is a university past examination paper for unit code '{unit_code}'.
        Extract all questions and structure them into JSON format:
        {{
          "questions": [
            {{
              "question_number": "Q1(a)",
              "question_text": "Full text of question",
              "marks": 5,
              "topic": "Topic Name",
              "sample_answer": "Key points for answering this question"
            }}
          ]
        }}
        Return strictly JSON object.
        """

        res = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=1200
        )

        questions_response = json.loads(res.choices[0].message.content)
        questions = questions_response.get("questions", [])

        doc = {
            "user_id": user_obj_id,
            "unit_code": unit_code,
            "year": year,
            "filename": file.filename,
            "questions": questions,
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        }
        res_db = past_papers_collection.insert_one(doc)
        doc["id"] = str(res_db.inserted_id)
        del doc["_id"]
        del doc["user_id"]

        return doc
    except Exception as e:
        raise handle_gemini_error(e)
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

@router.get("/past-papers")
def get_past_papers(token: str = Depends(oauth2_scheme)):
    user_id = get_current_user_id(token)
    user_obj_id = ObjectId(user_id)
    papers = list(past_papers_collection.find({"user_id": user_obj_id}))
    output = []
    for p in papers:
        p["id"] = str(p["_id"])
        del p["_id"]
        del p["user_id"]
        output.append(p)
    return output


@router.get("/offline-bundle")
def get_offline_bundle(token: str = Depends(oauth2_scheme)):
    """
    Fetch all core study data for the current student in one call so the
    frontend can persist notes (with extracted text), cached summaries, units,
    exams, active study plan, and SRS flashcards for full offline study.
    """
    user_id = get_current_user_id(token)
    user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    user_query = {"$or": [{"user_id": user_obj_id}, {"user_id": user_id}]} if user_obj_id else {"user_id": user_id}

    def serialize_doc(doc: dict) -> dict:
        d = dict(doc)
        if "_id" in d:
            d["id"] = str(d.pop("_id"))
        if "user_id" in d:
            d.pop("user_id", None)
        if "created_at" in d:
            ca = d.pop("created_at")
            d["date"] = ca.strftime("%b %d, %Y") if hasattr(ca, "strftime") else str(ca)[:10]
        # Remove raw filesystem paths
        d.pop("file_path", None)
        return d

    raw_notes = list(notes_collection.find(user_query).sort("created_at", -1))
    notes_list = [serialize_doc(n) for n in raw_notes]

    # Map cached summaries by note_id
    summaries_map = {}
    for s in summaries_collection.find({"user_id": user_id}):
        nid = s.get("note_id")
        if nid and s.get("summary_data"):
            summaries_map[nid] = s["summary_data"]

    units_list = [serialize_doc(u) for u in units_collection.find(user_query)]
    exams_list = [serialize_doc(e) for e in exams_collection.find(user_query).sort("exam_date", 1)]

    plan_doc = study_plans_collection.find_one(
        {**user_query, "type": "adaptive_plan"}
    )
    study_plan = None
    if plan_doc:
        study_plan = {
            "id": str(plan_doc["_id"]),
            "user_id": str(plan_doc.get("user_id", "")),
            "type": plan_doc.get("type"),
            "plan_data": plan_doc.get("plan_data"),
        }

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    srs_cards = [
        serialize_doc(c)
        for c in srs_flashcards_collection.find({
            **user_query,
            "next_review_date": {"$lte": today_str}
        }).limit(30)
    ]

    return {
        "notes": notes_list,
        "summaries": summaries_map,
        "units": units_list,
        "exams": exams_list,
        "study_plan": study_plan,
        "srs_cards": srs_cards,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
