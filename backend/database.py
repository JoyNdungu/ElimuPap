from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load the .env file so we can read MONGODB_URL
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")

# Create a connection to MongoDB Atlas with a 5 second timeout
# so it fails quickly instead of hanging forever if the IP is blocked
client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)

# Select the elimupap database
# If it does not exist MongoDB creates it automatically
db = client["elimupap"]

# Define our collections (like tables in a normal database)
users_collection = db["users"]
notes_collection = db["notes"]
summaries_collection = db["summaries"]
tutor_conversations_collection = db["tutor_conversations"]
quizzes_collection = db["quizzes"]
quiz_attempts_collection = db["quiz_attempts"]
weak_topics_collection = db["weak_topics"]
study_plans_collection = db["study_plans"]
exams_collection = db["exams"]

# These may be used by existing routes
units_collection = db["units"]
focus_areas_collection = db["focus_areas"]
sessions_collection = db["chat_sessions"]

# Test the connection when this file is run directly
if __name__ == "__main__":
    try:
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully")
    except Exception as e:
        print(f"❌ Connection failed: {e}")