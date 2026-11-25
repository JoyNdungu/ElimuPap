"""
Run this script once to initialize all MongoDB collections for ElimuPap.
MongoDB only creates collections when data is inserted, so this script
creates them explicitly with proper validation indexes.

Usage: python init_db.py
"""

from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
db = client["elimupap"]

COLLECTIONS = [
    "users",
    "notes",
    "summaries",
    "tutor_conversations",
    "quizzes",
    "quiz_attempts",
    "weak_topics",
    "study_plans",
    "exams",
    "units",
    "focus_areas",
    "chat_sessions",
    "srs_flashcards",
    "past_papers",
    "study_sessions",
    "activity_logs",
]

print("🚀 Initializing ElimuPap database...\n")

existing = db.list_collection_names()

for name in COLLECTIONS:
    if name in existing:
        print(f"  ✅ '{name}' — already exists")
    else:
        # Create the collection by creating it explicitly
        db.create_collection(name)
        print(f"  ✨ '{name}' — created")

# ── Indexes ────────────────────────────────────────────────────────────────────
print("\n📑 Setting up indexes...")

# users — unique email
db["users"].create_index([("email", ASCENDING)], unique=True, name="email_unique")
print("  ✅ users.email (unique)")

# notes — lookup by user
db["notes"].create_index([("user_id", ASCENDING)], name="notes_user_id")
print("  ✅ notes.user_id")

# summaries — lookup by note
db["summaries"].create_index([("note_id", ASCENDING)], name="summaries_note_id")
db["summaries"].create_index([("user_id", ASCENDING)], name="summaries_user_id")
print("  ✅ summaries.note_id & user_id")

# tutor_conversations — lookup by user
db["tutor_conversations"].create_index([("user_id", ASCENDING)], name="tutor_user_id")
print("  ✅ tutor_conversations.user_id")

# quizzes — lookup by user
db["quizzes"].create_index([("user_id", ASCENDING)], name="quizzes_user_id")
print("  ✅ quizzes.user_id")

# quiz_attempts — lookup by user & quiz
db["quiz_attempts"].create_index([("user_id", ASCENDING)], name="attempts_user_id")
db["quiz_attempts"].create_index([("quiz_id", ASCENDING)], name="attempts_quiz_id")
print("  ✅ quiz_attempts.user_id & quiz_id")

# weak_topics — lookup by user
db["weak_topics"].create_index([("user_id", ASCENDING)], name="weak_topics_user_id")
print("  ✅ weak_topics.user_id")

# study_plans — lookup by user
db["study_plans"].create_index([("user_id", ASCENDING)], name="plans_user_id")
print("  ✅ study_plans.user_id")

# units — lookup by user
db["units"].create_index([("user_id", ASCENDING)], name="units_user_id")
print("  ✅ units.user_id")

# exams — lookup by user & date
db["exams"].create_index([("user_id", ASCENDING), ("exam_date", ASCENDING)], name="exams_user_id_date")
print("  ✅ exams.user_id & exam_date")

# srs_flashcards — lookup by user & review date
db["srs_flashcards"].create_index([("user_id", ASCENDING), ("next_review", ASCENDING)], name="srs_flashcards_user_review")
print("  ✅ srs_flashcards.user_id & next_review")

# past_papers — lookup by unit code
db["past_papers"].create_index([("unit_code", ASCENDING), ("year", ASCENDING)], name="past_papers_unit_year")
print("  ✅ past_papers.unit_code & year")

# study_sessions — lookup by user
db["study_sessions"].create_index([("user_id", ASCENDING)], name="study_sessions_user_id")
print("  ✅ study_sessions.user_id")

# activity_logs — lookup for telemetry by user and type/timestamp/unit
db["activity_logs"].create_index([("user_id", ASCENDING), ("timestamp", ASCENDING)], name="activity_logs_user_id_timestamp")
db["activity_logs"].create_index([("user_id", ASCENDING), ("type", ASCENDING)], name="activity_logs_user_id_type")
db["activity_logs"].create_index([("user_id", ASCENDING), ("unit_code", ASCENDING)], name="activity_logs_user_id_unit_code")
print("  ✅ activity_logs.user_id, timestamp, type & unit_code")

print("\n🎉 Database initialization complete!")
print(f"   Collections in database: {db.list_collection_names()}")
