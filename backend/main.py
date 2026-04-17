from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

import models
import database
import auth
import agents
from database import get_db, engine
from pydantic import BaseModel

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SprintMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    name: str
    description: str = None
    members: List[str] = [] # List of emails

class SprintCreate(BaseModel):
    project_id: int
    goal: str

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None


class CommentCreate(BaseModel):
    content: str

class AICommentRequest(BaseModel):
    content: Optional[str] = None
    question: Optional[str] = None
    mode: str # help, edit


# --- Routes ---

# Project Routes
@app.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    # Get projects where user is owner or member
    projects = db.query(models.Project).filter(
        (models.Project.owner_id == current_user.id) | 
        (models.Project.members.any(id=current_user.id))
    ).all()
    return projects

@app.post("/projects")
def create_project(project_data: ProjectCreate, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    new_project = models.Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=current_user.id
    )
    # Add owner as member
    new_project.members.append(current_user)
    
    # Add other members by email
    for email in project_data.members:
        member = db.query(models.User).filter(models.User.email == email).first()
        if member and member.id != current_user.id:
            new_project.members.append(member)
            
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/project/{id}")
def get_project(id: int, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Return a dictionary with serialized members
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "members": [{"id": m.id, "name": m.name, "email": m.email} for m in project.members]
    }


# Sprint Routes


@app.post("/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(name=user.name, email=user.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@app.post("/auth/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = auth.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": {"name": db_user.name, "email": db_user.email}}

@app.post("/sprint/create")
async def create_sprint(sprint_data: SprintCreate, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    # Trigger LangGraph agent
    result = await agents.generate_sprint_tickets(sprint_data.goal)
    
    new_sprint = models.Sprint(
        user_id=current_user.id,
        project_id=sprint_data.project_id,
        name=f"Sprint for {sprint_data.goal[:30]}...",
        sprint_days=result["sprint_days"]
    )

    db.add(new_sprint)
    db.commit()
    db.refresh(new_sprint)
    
    for t in result["tickets"]:
        new_ticket = models.Ticket(
            sprint_id=new_sprint.id,
            title=t["title"],
            description=t.get("description", ""),
            priority=t.get("priority", "medium").lower(),
            status="todo"
        )
        db.add(new_ticket)
    
    db.commit()
    return {"sprint_id": new_sprint.id, "tickets_count": len(result["tickets"])}

@app.get("/sprint/{id}/tickets")
def get_tickets(id: int, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()
    tickets = db.query(models.Ticket).filter(models.Ticket.sprint_id == id).all()
    return tickets

@app.post("/sprint/{id}/tickets")
def create_ticket(id: int, ticket_data: TicketUpdate, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()
    new_ticket = models.Ticket(
        sprint_id=id,
        title=ticket_data.title or "New Task",
        description=ticket_data.description or "",
        status=ticket_data.status or "todo",
        priority=ticket_data.priority or "medium"
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket


@app.get("/project/{project_id}/sprints")
def get_sprints(project_id: int, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    return db.query(models.Sprint).filter(models.Sprint.project_id == project_id).order_by(models.Sprint.created_at.desc()).all()


@app.patch("/ticket/{id}")
def update_ticket(id: int, ticket_data: TicketUpdate, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket_data.title:
        ticket.title = ticket_data.title
    if ticket_data.description:
        ticket.description = ticket_data.description
    if ticket_data.status:
        ticket.status = ticket_data.status
    if ticket_data.priority:
        ticket.priority = ticket_data.priority
    if ticket_data.assigned_to_id is not None:
        ticket.assigned_to_id = ticket_data.assigned_to_id if ticket_data.assigned_to_id > 0 else None
        
    db.commit()
    db.refresh(ticket)
    return ticket

@app.delete("/ticket/{id}")
def delete_ticket(id: int, db: Session = Depends(get_db)):
    # Since we are in auth-less mode, we just find and delete
    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"message": "Ticket deleted"}


@app.post("/ticket/{id}/comment")
def add_comment(id: int, comment_data: CommentCreate, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    new_comment = models.Comment(
        ticket_id=id,
        user_id=current_user.id,
        content=comment_data.content
    )
    db.add(new_comment)
    db.commit()
    return {"message": "Comment added"}

@app.get("/ticket/{id}/comments")
def get_comments(id: int, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    return db.query(models.Comment).filter(models.Comment.ticket_id == id).all()

@app.post("/ticket/{id}/ai-comment")
async def ai_comment(id: int, req: AICommentRequest, db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    context = f"Ticket: {ticket.title}. Description: {ticket.description}. Status: {ticket.status}."
    
    if req.mode == "help":
        result = await agents.comment_assistant_help(context, req.question)
    else:
        result = await agents.comment_assistant_edit(req.content)
    
    return {"result": result}
    
@app.get("/my-issues")
def get_my_issues(db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    return db.query(models.Ticket).filter(models.Ticket.assigned_to_id == current_user.id).all()

@app.get("/inbox")
def get_inbox_activity(db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    # Simple inbox: latest comments on tickets assigned to or created by the user
    # Or just all comments for now to simulate an activity feed
    return db.query(models.Comment).order_by(models.Comment.created_at.desc()).limit(20).all()

@app.get("/all-sprints")
def get_all_sprints(db: Session = Depends(get_db)):
    current_user = db.query(models.User).first()

    return db.query(models.Sprint).order_by(models.Sprint.created_at.desc()).all()

