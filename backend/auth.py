from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext


from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import database
import models
from database import get_db
from models import User
import os

# Secret key to sign JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def verify_password(plain_password, hashed_password):
    if not hashed_password: return False # Handle placeholder users
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(db: Session = Depends(get_db), token: Optional[str] = Depends(oauth2_scheme)):
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email: str = payload.get("sub")
            if email:
                user = db.query(models.User).filter(models.User.email == email).first()
                if user:
                    return user
        except JWTError:
            pass
    
    # POC Bypass: Use first user or create one
    user = db.query(models.User).filter(models.User.password_hash != None).first()
    if not user:
        user = db.query(models.User).first()
        
    if not user:
        user = models.User(
            name="POC Admin", 
            email="admin@example.com", 
            password_hash=get_password_hash("password123")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user


