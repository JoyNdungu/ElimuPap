from fastapi import APIRouter, HTTPException, status
from database import users_collection
from models.user import UserRegister, UserLogin
from utils.auth import hash_password, verify_password, create_access_token
from bson import ObjectId
from datetime import datetime
import re

# APIRouter groups related endpoints together
# All routes here are prefixed with /auth
# So register becomes /auth/register
# and login becomes /auth/login
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(user: UserRegister):
    """
    Register a new student.
    Process:
    1. Check email not already used
    2. Hash the password
    3. Save to MongoDB
    4. Return JWT token
    """
    clean_email = user.email.strip().lower()

    # Check case-insensitively if email already exists in database
    existing = users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Build the user document to save in MongoDB
    user_doc = {
        "name": user.name.strip(),
        "email": clean_email,
        "password": hash_password(user.password),
        "university": user.university.strip(),
        "course": user.course.strip(),
        "year_of_study": user.year_of_study.strip(),
        "language": user.language,
        "is_premium": False,
        "created_at": datetime.utcnow()
    }

    # Insert into MongoDB
    # inserted_id is the unique ID MongoDB generates
    result = users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Create JWT token containing the user ID
    token = create_access_token({"sub": user_id})

    return {
        "message": "Registration successful",
        "token": token,
        "user": {
            "id": user_id,
            "name": user_doc["name"],
            "email": clean_email,
            "university": user_doc["university"],
            "course": user_doc["course"],
            "year_of_study": user_doc["year_of_study"],
            "language": user.language
        }
    }

@router.post("/login")
def login(credentials: UserLogin):
    """
    Log in an existing student.
    Process:
    1. Find user by email (case-insensitive & trimmed for mobile/cross-device login)
    2. Verify password
    3. Return JWT token
    """
    clean_email = credentials.email.strip().lower()

    # Find user by normalized email first, then case-insensitive fallback for older accounts
    user = users_collection.find_one({"email": clean_email}) or users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password against stored hash
    try:
        password_ok = verify_password(credentials.password, user["password"])
    except Exception:
        password_ok = False

    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create new token for this session
    token = create_access_token({"sub": str(user["_id"])})

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "university": user["university"],
            "course": user["course"],
            "year_of_study": user["year_of_study"],
            "language": user["language"]
        }
    }

@router.get("/me")
def get_current_user(token: str):
    """
    Get the profile of the currently logged in student.
    The frontend sends the token and we decode it
    to identify who is making the request.
    """
    from utils.auth import decode_token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "university": user["university"],
        "course": user["course"],
        "year_of_study": user["year_of_study"],
        "language": user["language"]
    }

@router.put("/profile")
def update_profile(body: dict, token: str = None):
    """
    Update the currently logged-in student's profile.
    Accepts Authorization: Bearer <token> header.
    """
    from fastapi import Header
    from utils.auth import decode_token as _decode
    # Token can come from request body for flexibility
    auth_token = body.pop("token", token)
    if not auth_token:
        raise HTTPException(status_code=401, detail="Token required")
    payload = _decode(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")

    allowed_fields = {"name", "university", "course", "year_of_study", "language"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields and v}

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    user = users_collection.find_one({"_id": ObjectId(user_id)})

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "university": user["university"],
            "course": user["course"],
            "year_of_study": user["year_of_study"],
            "language": user["language"]
        }
    }