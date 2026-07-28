import datetime
import uuid
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status
from backend.models.schemas import (
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("insightai.auth")

# Pre-populated Demo Users Store
DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "demo@insightai.io": {
        "id": "usr_demo_101",
        "name": "Demo Analyst",
        "email": "demo@insightai.io",
        "password": "password123",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        "role": "Lead BI Analyst",
        "company": "InsightAI Enterprise",
        "createdAt": "2026-01-01T00:00:00Z"
    },
    "alex@enterprise.com": {
        "id": "usr_alex_102",
        "name": "Alex Sterling",
        "email": "alex@enterprise.com",
        "password": "password123",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        "role": "Principal Data Officer",
        "company": "Global Analytics Corp",
        "createdAt": "2026-02-15T00:00:00Z"
    }
}


@router.post("/login", response_model=AuthResponse)
async def login(req: AuthLoginRequest):
    """
    Authenticates user with email & password.
    """
    email_clean = req.email.strip().lower()
    user = DEMO_USERS.get(email_clean)

    if not user or user["password"] != req.password:
        return AuthResponse(
            success=False,
            message="Invalid email address or password. For demo sign-in, use demo@insightai.io with password password123."
        )

    token = f"jwt_mock_token_{user['id']}_{int(datetime.datetime.utcnow().timestamp())}"

    user_resp = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        avatar=user.get("avatar"),
        role=user.get("role", "Enterprise Data Analyst"),
        company=user.get("company", "InsightAI Workspace"),
        token=token,
        createdAt=user.get("createdAt", datetime.datetime.utcnow().isoformat() + "Z")
    )

    return AuthResponse(
        success=True,
        user=user_resp,
        message="Sign in successful. Welcome to InsightAI!"
    )


@router.post("/register", response_model=AuthResponse)
async def register(req: AuthRegisterRequest):
    """
    Registers a new user account.
    """
    email_clean = req.email.strip().lower()

    if email_clean in DEMO_USERS:
        return AuthResponse(
            success=False,
            message="An account with this email address already exists. Please sign in instead."
        )

    new_id = f"usr_{uuid.uuid4().hex[:8]}"
    created_at = datetime.datetime.utcnow().isoformat() + "Z"

    new_user = {
        "id": new_id,
        "name": req.name.strip(),
        "email": email_clean,
        "password": req.password,
        "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={req.name.strip()}",
        "role": "Enterprise Data Analyst",
        "company": req.company.strip() if req.company else "InsightAI Workspace",
        "createdAt": created_at
    }

    DEMO_USERS[email_clean] = new_user
    token = f"jwt_mock_token_{new_id}_{int(datetime.datetime.utcnow().timestamp())}"

    user_resp = UserResponse(
        id=new_user["id"],
        name=new_user["name"],
        email=new_user["email"],
        avatar=new_user["avatar"],
        role=new_user["role"],
        company=new_user["company"],
        token=token,
        createdAt=created_at
    )

    return AuthResponse(
        success=True,
        user=user_resp,
        message="Account created successfully. Welcome to InsightAI!"
    )


@router.post("/reset-password")
async def request_password_reset(data: dict):
    """
    Handles password reset requests.
    """
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email address is required.")

    logger.info(f"[Auth] Password reset requested for {email}")
    return {
        "success": True,
        "message": f"Password reset email dispatched for {email}. Check your inbox!"
    }

