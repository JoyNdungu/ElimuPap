from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from bson import ObjectId
from database import study_plans_collection, focus_areas_collection
from models.study_plan import StudyTaskCreate, StudyTaskUpdate, FocusAreaCreate, FocusAreaUpdate
from utils.auth import decode_token
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime

router = APIRouter(prefix="/study-plan", tags=["Study Plan"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user_id(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload.get("sub")

# --- Active Adaptive Plan ---

@router.get("/active")
def get_active_plan(user_id: str = Depends(get_current_user_id)):
    """Fetch the currently active adaptive study plan."""
    plan = study_plans_collection.find_one({"user_id": ObjectId(user_id), "type": "adaptive_plan"})
    if not plan:
        raise HTTPException(status_code=404, detail="No active study plan found")
    
    plan["id"] = str(plan["_id"])
    del plan["_id"]
    plan["user_id"] = str(plan["user_id"])
    return plan

@router.delete("/active")
def delete_active_plan(user_id: str = Depends(get_current_user_id)):
    """Delete the currently active adaptive study plan."""
    result = study_plans_collection.delete_one({"user_id": ObjectId(user_id), "type": "adaptive_plan"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No active study plan found to delete")
    return {"message": "Active study plan deleted successfully"}

# --- Study Tasks ---

@router.get("/tasks", response_model=List[dict])
def get_tasks(user_id: str = Depends(get_current_user_id)):
    tasks = list(study_plans_collection.find({"user_id": user_id}).sort("scheduled_time", 1))
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
    return tasks

@router.post("/tasks")
def create_task(task: StudyTaskCreate, user_id: str = Depends(get_current_user_id)):
    task_dict = task.model_dump()
    task_dict["user_id"] = user_id
    result = study_plans_collection.insert_one(task_dict)
    task_dict["id"] = str(result.inserted_id)
    del task_dict["_id"]
    return task_dict

@router.put("/tasks/{task_id}")
def update_task(task_id: str, task_update: StudyTaskUpdate, user_id: str = Depends(get_current_user_id)):
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
    
    result = study_plans_collection.update_one(
        {"_id": ObjectId(task_id), "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated"}

@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    result = study_plans_collection.delete_one({"_id": ObjectId(task_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# --- Focus Areas ---

@router.get("/focus-areas", response_model=List[dict])
def get_focus_areas(user_id: str = Depends(get_current_user_id)):
    areas = list(focus_areas_collection.find({"user_id": user_id}).sort("mastery_percentage", 1))
    for a in areas:
        a["id"] = str(a["_id"])
        del a["_id"]
    return areas

@router.post("/focus-areas")
def create_focus_area(area: FocusAreaCreate, user_id: str = Depends(get_current_user_id)):
    area_dict = area.model_dump()
    area_dict["user_id"] = user_id
    result = focus_areas_collection.insert_one(area_dict)
    area_dict["id"] = str(result.inserted_id)
    del area_dict["_id"]
    return area_dict
