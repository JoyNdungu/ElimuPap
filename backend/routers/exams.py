from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from database import exams_collection, units_collection, users_collection
from utils.auth import decode_token
from bson import ObjectId
from openai import OpenAI
import base64
import mimetypes
import os
import re
import shutil
import json

router = APIRouter(prefix="/exams", tags=["Exams"])

DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
DEPRECATED_VISION_MODELS = {
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
}


def resolve_vision_model() -> str:
    configured = (os.getenv("GROQ_VISION_MODEL") or "").strip()
    if not configured or configured in DEPRECATED_VISION_MODELS:
        return DEFAULT_VISION_MODEL
    return configured


def extract_timetable_text(file_path: str, ext: str) -> str:
    if ext == ".pdf":
        import PyPDF2
        pages = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                txt = (page.extract_text() or "").strip()
                if txt:
                    pages.append(txt)
        return "\n\n".join(pages).strip()

    if ext == ".docx":
        import docx2txt
        return (docx2txt.process(file_path) or "").strip()

    if ext in {".txt", ".csv"}:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()

    return ""


def condense_timetable_text(text: str, units_info: list, max_chars: int = 8000) -> str:
    """Keep full text when short, or prioritize lines/context matching the student's registered units."""
    if len(text) <= max_chars:
        return text

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    normalized_codes = [
        re.sub(r"[^A-Z0-9]", "", (u.get("unit_code") or "").upper())
        for u in units_info
        if u.get("unit_code")
    ]
    title_words = set()
    for u in units_info:
        for w in re.findall(r"[A-Za-z]{4,}", u.get("unit_name") or ""):
            if w.lower() not in {"introduction", "fundamentals", "principles", "systems", "course", "unit"}:
                title_words.add(w.lower())

    keep_indices = set()
    date_pattern = re.compile(r"\b(mon|tue|wed|thu|fri|sat|sun|202\d|\d{1,2}[/-]\d{1,2})\b", re.I)

    for idx, line in enumerate(lines):
        norm_line = re.sub(r"[^A-Z0-9]", "", line.upper())
        low_line = line.lower()
        code_hit = any(code and code in norm_line for code in normalized_codes)
        title_hit = any(w in low_line for w in title_words)
        if code_hit or title_hit:
            # Include surrounding lines so date/time/venue headers remain attached
            for offset in range(-4, 5):
                j = idx + offset
                if 0 <= j < len(lines):
                    keep_indices.add(j)

    if keep_indices:
        # Also include top lines (document header / semester / year info)
        for j in range(min(10, len(lines))):
            keep_indices.add(j)
        selected = "\n".join(lines[i] for i in sorted(keep_indices))
        if len(selected) <= max_chars:
            return selected
        return selected[:max_chars]

    # Fallback: keep date lines + head
    date_lines = [l for l in lines if date_pattern.search(l)]
    combined = "\n".join(date_lines) if date_lines else text
    return combined[:max_chars]


class ExamCreate(BaseModel):
    unit_code: str
    exam_date: str  # YYYY-MM-DD
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
    """Upload a timetable PDF or image and parse it with AI to auto-create exams."""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    year_of_study = user.get("year_of_study", "Unknown") if user else "Unknown"

    units = list(units_collection.find({"user_id": ObjectId(user_id)}))
    unit_codes = [u.get("unit_code") for u in units if u.get("unit_code")]
    units_info = [
        {
            "unit_code": u.get("unit_code"),
            "unit_name": u.get("unit_name") or u.get("title") or "",
        }
        for u in units
        if u.get("unit_code")
    ]

    if not unit_codes:
        raise HTTPException(status_code=400, detail="You must register at least one unit first.")

    os.makedirs("uploads/tmp", exist_ok=True)
    safe_name = os.path.basename(file.filename or "timetable")
    file_path = os.path.join("uploads/tmp", f"{user_id}_{safe_name}")
    ext = os.path.splitext(safe_name)[1].lower()

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        from dotenv import load_dotenv
        load_dotenv(override=True)
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Groq API Key is not configured properly.")
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1", timeout=30.0)

        prompt = f"""
        Extract exam dates, times, and venues from this timetable.
        The student is in Year of Study: {year_of_study}.
        The student is registered for these specific units:
        {json.dumps(units_info, indent=2)}

        You should extract an exam if it matches ANY of the following criteria:
        1. The unit code on the timetable matches one of the student's registered unit codes (even if spacing differs, e.g. ICS2101 vs ICS 2101).
        2. The unit name on the timetable matches or closely resembles one of the student's registered unit_name values.
        3. The exam is grouped under the student's Year of Study (e.g., Year {year_of_study} or {year_of_study}.1 or similar notation).

        ONLY return exams that belong to the student's registered units.
        For each match, return the EXACT "unit_code" from the registered units list provided above.

        Return ONLY a JSON object with the following schema:
        {{
          "exams": [
            {{
              "unit_code": "The exact registered unit code",
              "exam_date": "YYYY-MM-DD format only",
              "exam_time": "HH:MM format",
              "venue": "Room or venue string"
            }}
          ]
        }}
        """

        is_document = ext in {".pdf", ".docx", ".txt", ".csv"} or (
            file.content_type in {"application/pdf", "text/plain", "text/csv"}
        )

        if is_document:
            extracted_text = extract_timetable_text(file_path, ext or ".pdf")
            if not extracted_text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not read text from this PDF (it may be a scanned image PDF). Please upload a screenshot/photo (PNG or JPG) of your timetable instead."
                )

            condensed_text = condense_timetable_text(extracted_text, units_info)
            text_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
            response = client.chat.completions.create(
                model=text_model,
                messages=[
                    {
                        "role": "user",
                        "content": f"{prompt}\n\nTIMETABLE TEXT:\n{condensed_text}",
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=1200,
            )
        else:
            with open(file_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")

            mime_type = file.content_type
            if not mime_type or not mime_type.startswith("image/"):
                guessed, _ = mimetypes.guess_type(safe_name)
                mime_type = guessed if guessed and guessed.startswith("image/") else "image/jpeg"

            vision_model = resolve_vision_model()
            response = client.chat.completions.create(
                model=vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                },
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=1200,
            )

        parsed_exams_response = json.loads(response.choices[0].message.content)
        parsed_exams = parsed_exams_response.get("exams", [])

        normalized_lookup = {
            re.sub(r"[^A-Z0-9]", "", code.upper()): code
            for code in unit_codes
        }

        created_exams = []
        for e in parsed_exams:
            raw_code = (e.get("unit_code") or "").strip()
            matched_code = None
            if raw_code in unit_codes:
                matched_code = raw_code
            else:
                norm = re.sub(r"[^A-Z0-9]", "", raw_code.upper())
                matched_code = normalized_lookup.get(norm)

            if matched_code and e.get("exam_date"):
                exam_doc = {
                    "user_id": ObjectId(user_id),
                    "unit_code": matched_code,
                    "exam_date": e.get("exam_date"),
                    "exam_time": e.get("exam_time"),
                    "venue": e.get("venue"),
                }
                exams_collection.update_one(
                    {"user_id": ObjectId(user_id), "unit_code": matched_code},
                    {"$set": exam_doc},
                    upsert=True,
                )
                created_exams.append(exam_doc)

        if not created_exams:
            return {
                "count": 0,
                "message": "Timetable read successfully, but none of your registered unit codes matched exams in this file. Check that your unit codes match the timetable or add them manually.",
            }

        return {
            "count": len(created_exams),
            "message": f"Successfully parsed {len(created_exams)} exam(s) for your registered units.",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse timetable: {str(e)}")
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
