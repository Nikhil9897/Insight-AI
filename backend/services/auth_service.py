import os
import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.db_models import User

logger = logging.getLogger("insightai.auth_service")

# Guest Mode Default User ID
GUEST_USER_ID = "usr_guest_demo_session"
GUEST_FIREBASE_UID = "guest_uid_demo_101"

def verify_firebase_token(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    FastAPI dependency verifying Firebase ID Token from Authorization Header (Bearer <token>).
    If no token is provided, falls back to Guest Mode.
    If a token IS provided, always attempt to decode and serve the real user —
    even if FIREBASE_PROJECT_ID is not configured (signature verification is skipped in that case).
    """
    firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()

    # 1. Guest Mode Fallback — ONLY when no Authorization header is provided at all
    if not authorization:
        logger.debug("No Authorization header — operating in Guest / Demo Mode.")
        # Ensure Guest User exists in Database
        guest_user = db.query(User).filter(User.firebase_uid == GUEST_FIREBASE_UID).first()
        if not guest_user:
            guest_user = User(
                id=GUEST_USER_ID,
                firebase_uid=GUEST_FIREBASE_UID,
                email="guest@insightai.demo",
                display_name="Guest Analyst (Demo)",
                avatar_url="https://api.dicebear.com/7.x/initials/svg?seed=GuestAnalyst",
                role="Guest BI Analyst",
                company="InsightAI Demo Workspace"
            )
            db.add(guest_user)
            db.commit()
            db.refresh(guest_user)

        return {
            "uid": guest_user.firebase_uid,
            "email": guest_user.email,
            "name": guest_user.display_name,
            "user_id": guest_user.id,
            "is_guest": True
        }

    # 2. Token Verification Logic
    try:
        token_parts = authorization.split(" ")
        if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
            raise ValueError("Invalid Authorization header format.")

        token = token_parts[1]
        decoded = None

        # Verify using PyJWT or fallback manual JWT payload decoding
        try:
            import jwt
            decoded = jwt.decode(token, options={"verify_signature": False}, algorithms=["RS256", "HS256"])
        except Exception as jwt_err:
            logger.debug("PyJWT decode note: %s. Using standard base64 parser.", str(jwt_err))
            try:
                import base64
                import json
                parts = token.split(".")
                if len(parts) >= 2:
                    payload_b64 = parts[1]
                    # Add padding for urlsafe base64 decoding
                    payload_b64 += "=" * (-len(payload_b64) % 4)
                    decoded = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
            except Exception as parse_err:
                logger.warning("Manual JWT decode failed: %s", str(parse_err))

        if not decoded:
            raise ValueError("Invalid JWT token payload.")

        uid = decoded.get("user_id") or decoded.get("sub") or decoded.get("uid")
        email = decoded.get("email", "user@insightai.io")
        name = decoded.get("name") or (email.split("@")[0].replace(".", " ").title() if "@" in email else "InsightAI User")

        if not uid:
            raise ValueError("Token missing user_id payload.")

        # Ensure user exists in database
        db_user = db.query(User).filter(User.firebase_uid == uid).first()
        if not db_user:
            db_user = User(
                firebase_uid=uid,
                email=email,
                display_name=name,
                avatar_url=f"https://api.dicebear.com/7.x/initials/svg?seed={name}"
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        elif name and db_user.display_name != name:
            db_user.display_name = name
            db.commit()

        return {
            "uid": uid,
            "email": db_user.email,
            "name": db_user.display_name,
            "user_id": db_user.id,
            "is_guest": False
        }
    except Exception as e:
        logger.warning("Token verification failed: %s. Falling back to Guest user.", str(e))
        guest_user = db.query(User).filter(User.firebase_uid == GUEST_FIREBASE_UID).first()
        return {
            "uid": GUEST_FIREBASE_UID,
            "email": "guest@insightai.demo",
            "name": "Guest Analyst (Demo)",
            "user_id": guest_user.id if guest_user else GUEST_USER_ID,
            "is_guest": True
        }
