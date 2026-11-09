"""
TerraPulse AI — Authentication Module
Handles password hashing, JWT token creation/verification, and user lookup.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel

from config import settings
from database import get_db, User, UserRole

# ─────────────────────────────────────────────────────────────────────────────
# Password hashing (Argon2)
# ─────────────────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─────────────────────────────────────────────────────────────────────────────
# JWT Tokens
# ─────────────────────────────────────────────────────────────────────────────

class TokenData(BaseModel):
    user_id: int
    role: str


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: Optional[int] = int(payload.get("sub"))
        role: Optional[str] = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        return TokenData(user_id=user_id, role=role)
    except JWTError:
        raise credentials_exception


# ─────────────────────────────────────────────────────────────────────────────
# Current User Dependencies
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    token_data = decode_token(token)
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# First-run admin and persistent user synchronization
# ─────────────────────────────────────────────────────────────────────────────

def create_first_admin(db: Session) -> None:
    """Create or update admin account and persistent user accounts on startup."""
    admin_email = (settings.ADMIN_EMAIL or "admin@terrapulse.local").strip()
    admin_password = (settings.ADMIN_PASSWORD or "TerraPulse@Admin2024").strip()
    admin_username = (settings.ADMIN_USERNAME or "admin").strip()

    # Always ensure the admin account exists with the designated password
    admin = db.query(User).filter(
        (User.username == admin_username) | (User.email == admin_email)
    ).first()

    if admin:
        admin.username = admin_username
        admin.email = admin_email
        admin.hashed_password = hash_password(admin_password)
        admin.role = UserRole.ADMIN
        admin.is_active = True
        db.commit()
        print(f"[TerraPulse] Admin verified & synchronized: {admin_email} / {admin_username}")
    else:
        admin = User(
            username=admin_username,
            email=admin_email,
            hashed_password=hash_password(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[TerraPulse] Admin account initialized: {admin_email}")

    # Ensure the registered user account is always seeded so redeploying never deletes it
    user_email = "antojenolin3126@gmail.com"
    existing_user = db.query(User).filter(
        (User.email == user_email) | (User.username == user_email)
    ).first()
    if not existing_user:
        # Default password hash for antojenolin3126@gmail.com
        user = User(
            username=user_email,
            email=user_email,
            hashed_password="$argon2id$v=19$m=65536,t=3,p=4$7Z2zVqo1BkAopfReixECYA$PtXJutYcOxOOg47xWfnMIsxjxFdYY0JtQButoKns41c",
            role=UserRole.USER,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"[TerraPulse] Persistent user seeded: {user_email}")
