import os
import shutil
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends, Header
from typing import Optional
from database import notes_collection
from utils.auth import decode_token
from bson import ObjectId
from datetime import datetime

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
            detail="Invalid or expired token"
        )
    return payload.get("sub")

@router.get("")
@router.get("/")
def get_notes(user_id: str = Depends(get_current_user_id)):
    """
    Get all notes uploaded by the current user.
    """
    notes = list(notes_collection.find({"user_id": ObjectId(user_id)}, {"extracted_text": 0}).sort("created_at", -1))
    for n in notes:
        n["id"] = str(n["_id"])
        del n["_id"]
        del n["user_id"]
        # Format date as string if needed
        if "created_at" in n:
            n["date"] = n["created_at"].strftime("%b %d, %Y")
            del n["created_at"]
    return notes

@router.post("/upload")
def upload_note(
    title: str = Form(...),
    unit_code: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Upload a new note document and extract text.
    """
    # Read token from Authorization: Bearer <token> header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    raw_token = authorization.split(" ")[1]
    payload = decode_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    # Generate a unique filename to prevent collisions
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    try:
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    finally:
        file.file.close()

    # Determine file type
    file_extension = safe_filename.split('.')[-1].lower() if '.' in safe_filename else 'unknown'
    
    if file_extension in ['doc', 'ppt']:
        raise HTTPException(status_code=400, detail="Legacy formats (.doc, .ppt) are not supported. Please upload .docx, .pptx, or .pdf files.")

    extracted_text = ""
    # Extract text if PDF
    if file_extension == 'pdf':
        try:
            import PyPDF2
            with open(file_path, 'rb') as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
        except Exception as e:
            print(f"Failed to extract text from PDF: {e}")
    # Extract text if DOCX
    elif file_extension in ['docx', 'doc']:
        try:
            import docx
            doc = docx.Document(file_path)
            extracted_text = "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            print(f"Failed to extract text from DOCX: {e}")
    # Extract text if PPTX
    elif file_extension in ['pptx', 'ppt']:
        try:
            import pptx
            prs = pptx.Presentation(file_path)
            text_runs = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text_runs.append(shape.text)
            extracted_text = "\n".join(text_runs)
        except Exception as e:
            print(f"Failed to extract text from PPTX: {e}")

    # Save metadata and text to database
    note_doc = {
        "user_id": ObjectId(user_id),
        "title": title,
        "unit_code": unit_code,
        "topic": topic,
        "filename": file.filename,
        "safe_filename": safe_filename,
        "file_path": file_path,
        "file_type": file_extension,
        "extracted_text": extracted_text,
        "created_at": datetime.utcnow()
    }

    result = notes_collection.insert_one(note_doc)
    note_id = str(result.inserted_id)

    return {
        "message": "File uploaded and processed successfully",
        "note_id": note_id,
        "filename": file.filename
    }

@router.delete("/{note_id}")
def delete_note(note_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a specific note and its physical file."""
    note = notes_collection.find_one({"_id": ObjectId(note_id), "user_id": ObjectId(user_id)})
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
        note = notes_collection.find_one({"_id": ObjectId(note_id), "user_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid note ID format.")
        
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or not authorized.")
        
    note["id"] = str(note["_id"])
    del note["_id"]
    del note["user_id"]
    if "created_at" in note:
        note["date"] = note["created_at"].strftime("%b %d, %Y")
        del note["created_at"]
        
    return note
