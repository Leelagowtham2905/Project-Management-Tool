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
from datetime import datetime, timedelta
import json


# Create DB tables
models.Base.metadata.create_all(bind=engine)
models.init_db()

app = FastAPI(title="SprintMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class MemberRole(BaseModel):
    email: str
    role: str

class ProjectCreate(BaseModel):
    name: str
    description: str = None
    members: List[MemberRole] = []

class SprintCreate(BaseModel):
    project_id: int
    goal: str

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None
    is_risky: Optional[bool] = None
    risk_reason: Optional[str] = None

class CommentCreate(BaseModel):
    content: str

class AICommentRequest(BaseModel):
    content: Optional[str] = None
    question: Optional[str] = None
    mode: str  # help | edit


# ─────────────────────────────────────────────────────────────────
# Auth Routes
# ─────────────────────────────────────────────────────────────────

@app.post("/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()

    if db_user:
        # Placeholder user created during project invite → claim the account
        if db_user.password_hash is not None:
            raise HTTPException(status_code=400, detail="Email already registered")
        db_user.name = user.name
        db_user.password_hash = auth.get_password_hash(user.password)
        db.commit()
        return {"message": "Account claimed successfully"}

    new_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=auth.get_password_hash(user.password),
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}


@app.post("/auth/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()

    # POC: auto-create user on first login
    if not db_user:
        new_user = models.User(
            name=user.email.split("@")[0],
            email=user.email,
            password_hash=auth.get_password_hash(user.password),
        )
        db.add(new_user)
        db.commit()
        db_user = new_user

    access_token = auth.create_access_token(data={"sub": db_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"name": db_user.name, "email": db_user.email},
    }


# ─────────────────────────────────────────────────────────────────
# Project Routes
# ─────────────────────────────────────────────────────────────────

@app.get("/projects")
def get_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Project).all()


@app.post("/projects")
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    new_project = models.Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=current_user.id,
    )
    db.add(new_project)
    db.flush()

    # Owner is always a Project Lead
    db.add(
        models.ProjectMembership(
            user_id=current_user.id,
            project_id=new_project.id,
            role="Project Lead",
        )
    )

    # Invite additional members by email + role
    for m in project_data.members:
        user = db.query(models.User).filter(models.User.email == m.email).first()
        if not user:
            # Placeholder — they can claim it on registration
            user = models.User(
                name=m.email.split("@")[0],
                email=m.email,
                password_hash=None,
            )
            db.add(user)
            db.flush()

        db.add(
            models.ProjectMembership(
                user_id=user.id,
                project_id=new_project.id,
                role=m.role,
            )
        )

    db.commit()
    db.refresh(new_project)
    return new_project


@app.get("/project/{id}")
def get_project(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "members": [
            {
                "id": m.user.id,
                "name": m.user.name,
                "email": m.user.email,
                "role": m.role,
            }
            for m in project.memberships
        ],
    }


# ─────────────────────────────────────────────────────────────────
# Sprint Routes
# ─────────────────────────────────────────────────────────────────

@app.get("/project/{project_id}/sprints")
def get_sprints(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Sprint)
        .filter(models.Sprint.project_id == project_id)
        .order_by(models.Sprint.created_at.desc())
        .all()
    )


@app.get("/all-sprints")
def get_all_sprints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Sprint).order_by(models.Sprint.created_at.desc()).all()


@app.post("/sprint/create")
async def create_sprint(
    sprint_data: SprintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    project = db.query(models.Project).filter(models.Project.id == sprint_data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build member list with name + email + role for the agent
    member_roles = [
        {"name": m.user.name, "email": m.user.email, "role": m.role}
        for m in project.memberships
    ]

    # ── Agent call ───────────────────────────────────────────────
    # The agent returns tickets where:
    #   - required_role = role the LLM chose (e.g. "Backend Developer")
    #   - assigned_to   = email chosen by the smart assignment engine
    result = await agents.generate_sprint_tickets(sprint_data.goal, member_roles)

    new_sprint = models.Sprint(
        user_id=current_user.id,
        project_id=sprint_data.project_id,
        name=f"Sprint: {sprint_data.goal[:40]}…",
        sprint_days=result["sprint_days"],
    )
    db.add(new_sprint)
    db.flush()

    now = datetime.utcnow()
    priority_days = {"high": 3, "medium": 5, "low": 7}

    for t in result["tickets"]:
        # ── Resolve email → user ID ──────────────────────────────
        assigned_email = (t.get("assigned_to") or "").strip().lower()
        assignee_id = _resolve_assignee(db, project.id, assigned_email, project.owner_id)

        due_date = now + timedelta(
            days=priority_days.get(t.get("priority", "medium").lower(), 5)
        )

        db.add(
            models.Ticket(
                sprint_id=new_sprint.id,
                title=t["title"],
                description=t.get("description", ""),
                priority=t.get("priority", "medium").lower(),
                status="todo",
                due_date=due_date,
                assigned_to_id=assignee_id,
            )
        )

    db.commit()
    return {"sprint_id": new_sprint.id, "tickets_count": len(result["tickets"])}


def _resolve_assignee(
    db: Session,
    project_id: int,
    email: str,
    fallback_owner_id: int,
) -> Optional[int]:
    """
    Resolves an email address to a user_id that is a member of the project.
    Falls back to the project owner if the email is not found.
    """
    if not email:
        return fallback_owner_id

    membership = (
        db.query(models.ProjectMembership)
        .join(models.User)
        .filter(
            models.ProjectMembership.project_id == project_id,
            models.User.email == email,
        )
        .first()
    )

    if membership:
        return membership.user_id

    # Email not in project — log and fall back to owner
    print(f"[WARN] _resolve_assignee: '{email}' is not a member of project {project_id}. Falling back to owner.")
    return fallback_owner_id


# ─────────────────────────────────────────────────────────────────
# Ticket Routes
# ─────────────────────────────────────────────────────────────────

@app.get("/sprint/{id}/tickets")
def get_tickets(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Ticket).filter(models.Ticket.sprint_id == id).all()


@app.get("/project/{id}/all-tickets")
def get_project_all_tickets(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tickets = (
        db.query(models.Ticket)
        .join(models.Sprint)
        .filter(models.Sprint.project_id == id)
        .all()
    )
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "assigned_to_id": t.assigned_to_id,
            "assigned_to_name": t.assigned_to.name if t.assigned_to else "Unassigned",
            "sprint_name": t.sprint.name,
            "is_risky": t.is_risky,
            "risk_reason": t.risk_reason,
        }
        for t in tickets
    ]


@app.post("/sprint/{id}/tickets")
def create_ticket(
    id: int,
    ticket_data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not ticket_data.due_date:
        p_days = {"high": 3, "medium": 5, "low": 7}.get(
            (ticket_data.priority or "medium").lower(), 5
        )
        due_date = datetime.utcnow() + timedelta(days=p_days)
    else:
        due_date = ticket_data.due_date

    new_ticket = models.Ticket(
        sprint_id=id,
        title=ticket_data.title or "New Task",
        description=ticket_data.description or "",
        status=ticket_data.status or "todo",
        priority=ticket_data.priority or "medium",
        due_date=due_date,
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket


@app.patch("/ticket/{id}")
def update_ticket(
    id: int,
    ticket_data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket_data.title is not None:
        ticket.title = ticket_data.title
    if ticket_data.description is not None:
        ticket.description = ticket_data.description
    if ticket_data.status is not None:
        ticket.status = ticket_data.status
        if ticket_data.status == "done":
            ticket.is_risky = False
            ticket.risk_reason = None
    if ticket_data.priority is not None:
        ticket.priority = ticket_data.priority
    if ticket_data.assigned_to_id is not None:
        ticket.assigned_to_id = ticket_data.assigned_to_id if ticket_data.assigned_to_id > 0 else None
    if ticket_data.due_date is not None:
        ticket.due_date = ticket_data.due_date
    if ticket_data.is_risky is not None:
        ticket.is_risky = ticket_data.is_risky
    if ticket_data.risk_reason is not None:
        ticket.risk_reason = ticket_data.risk_reason

    db.commit()
    db.refresh(ticket)
    return ticket


@app.delete("/ticket/{id}")
def delete_ticket(id: int, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"message": "Ticket deleted"}


# ─────────────────────────────────────────────────────────────────
# Comment Routes
# ─────────────────────────────────────────────────────────────────

@app.post("/ticket/{id}/comment")
def add_comment(
    id: int,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db.add(
        models.Comment(
            ticket_id=id,
            user_id=current_user.id,
            content=comment_data.content,
        )
    )
    db.commit()
    return {"message": "Comment added"}


@app.get("/ticket/{id}/comments")
def get_comments(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Comment).filter(models.Comment.ticket_id == id).all()


@app.post("/ticket/{id}/ai-comment")
async def ai_comment(
    id: int,
    req: AICommentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    context = (
        f"Ticket: {ticket.title}. "
        f"Description: {ticket.description}. "
        f"Status: {ticket.status}."
    )

    if req.mode == "help":
        result = await agents.comment_assistant_help(context, req.question)
    else:
        result = await agents.comment_assistant_edit(req.content)

    return {"result": result}


# ─────────────────────────────────────────────────────────────────
# User-level Routes
# ─────────────────────────────────────────────────────────────────

@app.get("/my-issues")
def get_my_issues(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Ticket)
        .filter(models.Ticket.assigned_to_id == current_user.id)
        .all()
    )


@app.get("/inbox")
def get_inbox_activity(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Comment)
        .order_by(models.Comment.created_at.desc())
        .limit(20)
        .all()
    )


# ─────────────────────────────────────────────────────────────────
# Risk Detection
# ─────────────────────────────────────────────────────────────────

@app.post("/sprint/{id}/detect-risks")
async def detect_risks(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tickets = db.query(models.Ticket).filter(models.Ticket.sprint_id == id).all()
    if not tickets:
        return []

    now = datetime.utcnow()

    # Rule-based: mark overdue tickets immediately
    for t in tickets:
        if t.status != "done" and t.due_date and t.due_date < now:
            t.is_risky = True
            t.risk_reason = "Overdue"
    db.commit()

    # AI analysis
    tickets_data = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "assignee": t.assigned_to.name if t.assigned_to else "Unassigned",
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "description": t.description,
        }
        for t in tickets
    ]

    analysis = await agents.analyze_sprint_risks(
        json.dumps(tickets_data),
        current_date=now.strftime("%Y-%m-%d %H:%M:%S"),
    )

    # Persist AI analysis back to DB
    for res in analysis:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == res["ticket_id"]).first()
        if ticket:
            if res["risk_level"] in ["high", "medium"]:
                ticket.is_risky = True
                ticket.risk_reason = ", ".join(res["reasons"])
            else:
                # Don't clear if rule-based overdue flag was already set
                if ticket.risk_reason != "Overdue":
                    ticket.is_risky = False
                    ticket.risk_reason = None
    db.commit()

    return analysis