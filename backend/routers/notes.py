import os
import shutil
import threading
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Header
from typing import Optional
from database import notes_collection
from utils.auth import decode_token
from bson import ObjectId
from datetime import datetime

# ---------------------------------------------------------------------------
# Text extraction – all dependencies are installed via requirements.txt,
# never via runtime pip. Imports happen once at module load.
# ---------------------------------------------------------------------------
try:
    import docx2txt
    _HAS_DOCX2TXT = True
except ImportError:
    _HAS_DOCX2TXT = False

try:
    import docx as _docx_module
    _HAS_PYTHON_DOCX = True
except ImportError:
    _HAS_PYTHON_DOCX = False

try:
    import PyPDF2
    _HAS_PYPDF2 = True
except ImportError:
    _HAS_PYPDF2 = False

try:
    import pptx as _pptx_module
    _HAS_PPTX = True
except ImportError:
    _HAS_PPTX = False


def extract_text_from_file(file_path: str, ext: str) -> str:
    """Extract text from a file. Always returns a string (never raises)."""
    extracted_text = ""

    if ext == "pdf":
        if not _HAS_PYPDF2:
            return "Text extraction unavailable: PyPDF2 is not installed."
        try:
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
            if not extracted_text.strip():
                extracted_text = (
                    "This PDF appears to be a scanned document or image-only. "
                    "We cannot extract text from image-based PDFs."
                )
        except Exception as e:
            extracted_text = f"Could not read this PDF.\n\nError: {e}"

    elif ext in ("docx", "doc"):
        # Try docx2txt first (faster, more reliable)
        if _HAS_DOCX2TXT:
            try:
                extracted_text = docx2txt.process(file_path) or ""
            except Exception:
                extracted_text = ""

        # Fallback to python-docx
        if not extracted_text.strip() and _HAS_PYTHON_DOCX:
            try:
                doc = _docx_module.Document(file_path)
                paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                cells = [
                    cell.text.strip()
                    for table in doc.tables
                    for row in table.rows
                    for cell in row.cells
                    if cell.text.strip()
                ]
                extracted_text = "\n".join(paras + cells)
            except Exception as e:
                extracted_text = (
                    f"Could not read this document. Ensure it is a valid .docx file.\n\nError: {e}"
                )

        if not extracted_text.strip():
            extracted_text = "This document appears to contain no readable text."

    elif ext in ("pptx", "ppt"):
        if not _HAS_PPTX:
            return "Text extraction unavailable: python-pptx is not installed."
        try:
            prs = _pptx_module.Presentation(file_path)
            slide_blocks = []
            for idx, slide in enumerate(prs.slides):
                slide_num = idx + 1
                lines = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        lines.append(shape.text.strip())
                if lines:
                    title = lines[0]
                    body = "\n".join(lines[1:])
                    slide_blocks.append(f"Slide {slide_num}: {title}\n{body}".strip())
                else:
                    slide_blocks.append(f"Slide {slide_num}")
            extracted_text = "\n\n".join(slide_blocks)
            if not extracted_text.strip():
                extracted_text = "This presentation appears to contain no readable text."
        except Exception as e:
            extracted_text = f"Could not read this presentation.\n\nError: {e}"

    elif ext in ("txt", "md"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_text = f.read()
        except Exception as e:
            extracted_text = f"Could not read this text file.\n\nError: {e}"

    return extracted_text.strip()


CONVERT_DIR = "converted"
os.makedirs(CONVERT_DIR, exist_ok=True)


def convert_to_pdf(file_path: str, ext: str) -> Optional[str]:
    """
    Convert a DOCX or PPTX to PDF.
    Returns the path to the generated PDF, or None if conversion failed.

    Strategy:
      1. LibreOffice headless  (free, cross-platform — best)
      2. docx2pdf              (uses MS Word on Windows — fallback)
    """
    if ext not in ("docx", "pptx", "doc", "ppt"):
        return None

    out_filename = os.path.splitext(os.path.basename(file_path))[0] + ".pdf"
    out_path = os.path.join(CONVERT_DIR, out_filename)

import subprocess as _subprocess
import shutil as _shutil

# ── Check at startup whether any PDF converter is available ─────────────────
_LO_BIN = next(
    (
        c for c in [
            "soffice",
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
        if _shutil.which(c) or os.path.exists(c)
    ),
    None,
)

_HAS_DOCX2PDF = False
try:
    import docx2pdf as _docx2pdf_module  # noqa: F401
    _HAS_DOCX2PDF = True
except ImportError:
    pass

CONVERSION_AVAILABLE = bool(_LO_BIN or _HAS_DOCX2PDF)
print(f"[conversion] LibreOffice: {_LO_BIN}, docx2pdf: {_HAS_DOCX2PDF}")


def convert_to_pdf(file_path: str, ext: str) -> Optional[str]:
    """
    Convert DOCX/PPTX to PDF. Returns the output path or None.
    Fails immediately if no converter is installed — never hangs.
    """
    if ext not in ("docx", "pptx", "doc", "ppt"):
        return None
    if not CONVERSION_AVAILABLE:
        print("[conversion] No PDF converter available. Skipping.")
        return None

    out_filename = os.path.splitext(os.path.basename(file_path))[0] + ".pdf"
    out_path = os.path.join(CONVERT_DIR, out_filename)

    # ── 1. LibreOffice headless ───────────────────────────────────────────────
    if _LO_BIN:
        try:
            _subprocess.run(
                [_LO_BIN, "--headless", "--convert-to", "pdf",
                 "--outdir", CONVERT_DIR, file_path],
                timeout=60,
                check=True,
                capture_output=True,
            )
            if os.path.exists(out_path):
                return out_path
        except Exception as e:
            print(f"[conversion] LibreOffice failed: {e}")

    # ── 2. docx2pdf (MS Word) ─────────────────────────────────────────────────
    if _HAS_DOCX2PDF and ext in ("docx", "doc"):
        try:
            from docx2pdf import convert
            convert(file_path, out_path)
            if os.path.exists(out_path):
                return out_path
        except Exception as e:
            print(f"[conversion] docx2pdf failed: {e}")

    return None


def _extract_and_save(note_id: ObjectId, file_path: str, ext: str):
    """Background worker: extract text AND convert to PDF, then update the DB."""
    updates: dict = {}

    # Text extraction
    try:
        text = extract_text_from_file(file_path, ext)
        updates["extracted_text"] = text
        updates["extraction_status"] = "done"
    except Exception as e:
        updates["extracted_text"] = f"Extraction failed: {e}"
        updates["extraction_status"] = "error"

    # PDF conversion (DOCX / PPTX only)
    if ext in ("docx", "pptx", "doc", "ppt"):
        if not CONVERSION_AVAILABLE:
            # No converter on this machine — tell the frontend immediately
            updates["conversion_status"] = "not_available"
        else:
            pdf_path = convert_to_pdf(file_path, ext)
            if pdf_path:
                updates["converted_pdf_path"] = pdf_path
                updates["converted_pdf_filename"] = os.path.basename(pdf_path)
                updates["conversion_status"] = "done"
            else:
                updates["conversion_status"] = "failed"

    notes_collection.update_one({"_id": note_id}, {"$set": updates})

    # Pre-warm AI summary in background so opening Summary is instant
    if updates.get("extraction_status") == "done" and updates.get("extracted_text"):
        try:
            note_doc = notes_collection.find_one({"_id": note_id})
            if note_doc and note_doc.get("user_id"):
                from routers.ai import build_and_cache_summary
                build_and_cache_summary(note_doc, str(note_doc["user_id"]))
        except Exception as e:
            print(f"[notes] Background summary pre-warm skipped: {e}")


# ---------------------------------------------------------------------------

router = APIRouter(prefix="/notes", tags=["Notes"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_current_user_id(authorization: str = Header(None)) -> str:
    """Read JWT from Authorization: Bearer <token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload.get("sub")


@router.get("")
@router.get("/")
def get_notes(user_id: str = Depends(get_current_user_id)):
    """Get all notes uploaded by the current user."""
    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    notes = list(
        notes_collection.find(user_query, {"extracted_text": 0}).sort(
            "created_at", -1
        )
    )
    for n in notes:
        n["id"] = str(n["_id"])
        del n["_id"]
        if "user_id" in n:
            del n["user_id"]
        if "created_at" in n:
            if hasattr(n["created_at"], "strftime"):
                n["date"] = n["created_at"].strftime("%b %d, %Y")
            else:
                n["date"] = str(n["created_at"])[:10]
            del n["created_at"]
    return notes


@router.post("/upload")
def upload_note(
    title: str = Form(...),
    unit_code: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    file: UploadFile = File(...),
    authorization: str = Header(None),
):
    """
    Upload a new note document.
    The file is saved immediately and text extraction runs in a background
    thread so the response is returned in under a second.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    raw_token = authorization.split(" ")[1]
    payload = decode_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    finally:
        file.file.close()

    file_extension = safe_filename.split(".")[-1].lower() if "." in safe_filename else "unknown"

    if file_extension in ("doc", "ppt"):
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail="Legacy formats (.doc, .ppt) are not supported. Please upload .docx, .pptx, or .pdf files.",
        )

    # Extract plain text synchronously for .txt / .md so Speech-to-Text notes open immediately
    sync_text = ""
    is_plain_text = file_extension in ("txt", "md")
    if is_plain_text:
        sync_text = extract_text_from_file(file_path, file_extension)

    # Save record immediately with extraction_status = 'pending' (or 'done' for instant text notes)
    note_doc = {
        "user_id": ObjectId(user_id),
        "title": title,
        "unit_code": unit_code or "GENERAL",
        "topic": topic,
        "filename": file.filename,
        "safe_filename": safe_filename,
        "file_path": file_path,
        "file_type": file_extension,
        "extracted_text": sync_text,
        "extraction_status": "done" if is_plain_text else "pending",
        "created_at": datetime.utcnow(),
    }
    result = notes_collection.insert_one(note_doc)
    note_id = result.inserted_id

    if not is_plain_text:
        # Kick off extraction in background — upload returns immediately
        thread = threading.Thread(
            target=_extract_and_save,
            args=(note_id, file_path, file_extension),
            daemon=True,
        )
        thread.start()

    return {
        "message": "File uploaded successfully. Text extraction is processing in the background.",
        "id": str(note_id),
        "note_id": str(note_id),
        "filename": file.filename,
    }


@router.delete("/{note_id}")
def delete_note(note_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a specific note and its physical file."""
    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    try:
        note = notes_collection.find_one({"_id": ObjectId(note_id), **user_query})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID format.")

    if not note:
        raise HTTPException(status_code=404, detail="Note not found or not authorized.")

    file_path = note.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")

    result = notes_collection.delete_one({"_id": ObjectId(note_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete note from database.")

    return {"message": "Note deleted successfully."}


@router.get("/{note_id}")
def get_note(note_id: str, user_id: str = Depends(get_current_user_id)):
    """Get a single note with its extracted text."""
    try:
        obj_id = ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID format.")

    user_query = {"$or": [{"user_id": ObjectId(user_id)}, {"user_id": user_id}]} if ObjectId.is_valid(user_id) else {"user_id": user_id}
    note = notes_collection.find_one({"_id": obj_id, **user_query})

    # Graceful fallback: if note exists in system
    if not note:
        note = notes_collection.find_one({"_id": obj_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found.")

    # If extraction is still pending, return status so frontend can poll
    if note.get("extraction_status") == "pending":
        note["extracted_text"] = "__EXTRACTING__"

    # On-the-fly retry for old notes that have empty text and no extraction_status
    elif not note.get("extracted_text", "").strip() and not note.get("extraction_status"):
        if note.get("file_path") and os.path.exists(note["file_path"]):
            thread = threading.Thread(
                target=_extract_and_save,
                args=(obj_id, note["file_path"], note.get("file_type", "")),
                daemon=True,
            )
            thread.start()
            note["extracted_text"] = "__EXTRACTING__"

    note["id"] = str(note["_id"])
    note.pop("_id", None)
    note.pop("user_id", None)

    if "created_at" in note:
        if hasattr(note["created_at"], "strftime"):
            note["date"] = note["created_at"].strftime("%b %d, %Y")
        else:
            note["date"] = str(note["created_at"])[:10]
        note.pop("created_at", None)

    return note
