from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from routers import auth, notes, units, study_plan, ai, progress, exams

load_dotenv()

app = FastAPI(
    title="ElimuPap API",
    description="AI-Powered Academic Assistant for Kenyan University Students",
    version="1.0.0",
    redirect_slashes=False   # prevents 307 redirects that strip Authorization headers
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://elimupap.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register the routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(units.router)
app.include_router(study_plan.router)
app.include_router(ai.router)
app.include_router(progress.router)
app.include_router(exams.router)

@app.get("/")
def root():
    return {
        "message": "ElimuPap API is running",
        "version": "1.0.0"
    }