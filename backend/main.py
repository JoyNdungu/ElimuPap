from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
load_dotenv()

from routers import auth, notes, units, study_plan, ai, progress, exams, search

app = FastAPI(
    title="ElimuPap API",
    description="AI-Powered Academic Assistant for Kenyan University Students",
    version="1.0.0",
    redirect_slashes=False   # prevents 307 redirects that strip Authorization headers
)

import os

frontend_url = os.getenv("FRONTEND_URL", "").strip()
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://elimupap.vercel.app",
]
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("converted", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/converted", StaticFiles(directory="converted"), name="converted")


# Register the routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(units.router)
app.include_router(study_plan.router)
app.include_router(ai.router)
app.include_router(progress.router)
app.include_router(exams.router)
app.include_router(search.router)

@app.on_event("startup")
def startup_db_indexes():
    from database import db
    import pymongo
    try:
        # Ensure critical performance indexes exist
        db["users"].create_index([("email", pymongo.ASCENDING)], unique=True, background=True)
        db["notes"].create_index([("user_id", pymongo.ASCENDING)], background=True)
        db["notes"].create_index([("unit_code", pymongo.ASCENDING)], background=True)
        db["summaries"].create_index([("note_id", pymongo.ASCENDING), ("user_id", pymongo.ASCENDING)], unique=True, background=True)
        db["tutor_conversations"].create_index([("user_id", pymongo.ASCENDING), ("client_id", pymongo.ASCENDING)], unique=True, background=True)
        db["tutor_conversations"].create_index([("user_id", pymongo.ASCENDING), ("updated_at", pymongo.DESCENDING)], background=True)
        db["units"].create_index([("user_id", pymongo.ASCENDING)], background=True)
        db["exams"].create_index([("user_id", pymongo.ASCENDING)], background=True)
        db["study_plans"].create_index([("user_id", pymongo.ASCENDING)], background=True)
        db["srs_flashcards"].create_index([("user_id", pymongo.ASCENDING)], background=True)
        db["activity_logs"].create_index([("user_id", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)], background=True)
        db["activity_logs"].create_index([("user_id", pymongo.ASCENDING), ("type", pymongo.ASCENDING)], background=True)
        db["activity_logs"].create_index([("user_id", pymongo.ASCENDING), ("unit_code", pymongo.ASCENDING)], background=True)
    except Exception as e:
        print(f"[db] Index verification notice: {e}")

@app.get("/")
def root():
    return {
        "message": "ElimuPap API is running",
        "version": "1.0.0"
    }