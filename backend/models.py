from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum
from database import SessionLocal

Base = declarative_base()

class Priority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"

class Status(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"

from sqlalchemy import Table

# Association table for User-Project many-to-many relationship
project_members = Table(
    'project_members',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    
    # Relationships
    owned_projects = relationship("Project", back_populates="owner")
    projects = relationship("Project", secondary=project_members, back_populates="members")
    sprints = relationship("Sprint", back_populates="user")
    comments = relationship("Comment", back_populates="user")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    members = relationship("User", secondary=project_members, back_populates="projects")
    sprints = relationship("Sprint", back_populates="project")


class Sprint(Base):
    __tablename__ = "sprints"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    sprint_days = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="sprints")
    project = relationship("Project", back_populates="sprints")
    tickets = relationship("Ticket", back_populates="sprint")


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"))
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String)
    description = Column(String)
    priority = Column(Enum(Priority), default=Priority.medium)
    status = Column(Enum(Status), default=Status.todo)
    
    # Relationships
    sprint = relationship("Sprint", back_populates="tickets")
    assigned_to = relationship("User")
    comments = relationship("Comment", back_populates="ticket")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    ticket = relationship("Ticket", back_populates="comments")
    user = relationship("User", back_populates="comments")

def init_db():
    import auth
    session = SessionLocal()
    try:
        # Check if users already exist
        emails = ["leelagowtham5@gmail.com", "govind09@gail.com"]
        for email in emails:
            user = session.query(User).filter(User.email == email).first()
            password = "Nandhu@1264" if email == "leelagowtham5@gmail.com" else "Govind@3456"
            hashed = auth.get_password_hash(password)
            
            if not user:
                new_user = User(name="Gowtham" if "leela" in email else "Govind", email=email, password_hash=hashed)
                session.add(new_user)
            elif not user.password_hash.startswith("$pbkdf2-sha256$"):  # Check for PBKDF2 hash
                user.password_hash = hashed

        
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error initializing users: {e}")
    finally:
        session.close()



# Initialize database with temporary users
init_db()