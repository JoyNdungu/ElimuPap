from fastapi import APIRouter, HTTPException, status, Header, Depends
from typing import List, Optional
from database import units_collection, notes_collection
from models.unit import UnitCreate, UnitUpdate
from utils.auth import decode_token
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/units", tags=["Units"])

def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload.get("sub")

@router.get("")
@router.get("/")
def get_units(user_id: str = Depends(get_current_user_id)):
    """Get all units registered by the current user."""
    units = list(units_collection.find({"user_id": ObjectId(user_id)}))
    for u in units:
        u["id"] = str(u["_id"])
        del u["_id"]
        del u["user_id"]
    return units

@router.post("")
@router.post("/")
def create_unit(unit: UnitCreate, user_id: str = Depends(get_current_user_id)):
    """Register a new unit."""
    # Check if unit code already exists for this user
    existing = units_collection.find_one({
        "user_id": ObjectId(user_id),
        "unit_code": unit.unit_code
    })
    if existing:
        raise HTTPException(status_code=400, detail="Unit code already registered.")

    doc = {
        "user_id": ObjectId(user_id),
        "unit_code": unit.unit_code,
        "unit_name": unit.unit_name,
        "topics": unit.topics,
        "created_at": datetime.utcnow()
    }
    result = units_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    del doc["user_id"]
    return doc

@router.put("/{unit_id}")
def update_unit(unit_id: str, unit: UnitUpdate, user_id: str = Depends(get_current_user_id)):
    """Update an existing unit."""
    existing = units_collection.find_one({"_id": ObjectId(unit_id), "user_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Unit not found.")

    update_data = {}
    if unit.unit_code is not None:
        update_data["unit_code"] = unit.unit_code
    if unit.unit_name is not None:
        update_data["unit_name"] = unit.unit_name
    if unit.topics is not None:
        update_data["topics"] = unit.topics

    if update_data:
        units_collection.update_one(
            {"_id": ObjectId(unit_id)},
            {"$set": update_data}
        )

    updated = units_collection.find_one({"_id": ObjectId(unit_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    del updated["user_id"]
    return updated

@router.delete("/{unit_id}")
def delete_unit(unit_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a unit and all associated notes."""
    # Find the unit to get the unit_code
    unit = units_collection.find_one({"_id": ObjectId(unit_id), "user_id": ObjectId(user_id)})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found or not authorized.")
    
    unit_code = unit.get("unit_code")

    if unit_code:
        # Find all notes associated with this unit
        notes = list(notes_collection.find({"user_id": ObjectId(user_id), "unit_code": unit_code}))
        
        # Delete physical files
        import os
        for note in notes:
            file_path = note.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")
        
        # Delete note documents
        notes_collection.delete_many({"user_id": ObjectId(user_id), "unit_code": unit_code})

    # Finally, delete the unit
    result = units_collection.delete_one({"_id": ObjectId(unit_id)})
    
    return {"message": "Unit and associated notes deleted successfully."}
