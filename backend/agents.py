import os
from typing import List, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=api_key, temperature=0.7)


# ─────────────────────────────────────────────────────────────────
# Types
# ─────────────────────────────────────────────────────────────────

class TicketDict(TypedDict):
    title: str
    description: str
    priority: str        # high | medium | low
    required_role: str   # role name from team (set by LLM)
    assigned_to: str     # email (set by assignment engine, NOT the LLM)


class SprintState(TypedDict):
    goal: str
    member_roles: List[dict]
    tickets: List[TicketDict]
    sprint_days: int


# ─────────────────────────────────────────────────────────────────
# Smart Assignment Engine
# ─────────────────────────────────────────────────────────────────

# Max tasks assigned to one person before overflowing to a peer with the same role
MAX_TASKS_PER_PERSON = 2


def _normalize(text: str) -> str:
    """Lowercase + strip noise for fuzzy role matching."""
    return (
        text.lower()
        .strip()
        .replace("-", " ")
        .replace("_", " ")
        .replace("/", " ")
    )


def _role_matches(member_role: str, required_role: str) -> bool:
    """
    True if the member's role is relevant to the required role.
    Uses keyword overlap so 'Senior Backend Developer' still matches 'backend developer'.
    """
    STOP = {"senior", "junior", "lead", "staff", "principal", "associate", "mid", "level"}
    m_words = {w for w in _normalize(member_role).split() if w not in STOP}
    r_words = {w for w in _normalize(required_role).split() if w not in STOP}
    return bool(m_words & r_words)


def assign_tickets(tickets: List[dict], members: List[dict]) -> List[TicketDict]:
    """
    Assigns each ticket to the most suitable team member.

    Assignment rules (in order):
    1. Role match   – find members whose role matches ticket's required_role
    2. Load cap     – prefer members with < MAX_TASKS_PER_PERSON assignments
    3. Least loaded – among eligible candidates, pick whoever has fewest tasks
    4. Overflow     – if every matching member is at/over cap, still use the
                      least-loaded one (don't leave tickets unassigned)
    5. Fallback     – if NO member matches the role at all, assign to the
                      Project Lead; if no lead exists, pick whoever has the fewest tasks
    """
    load: dict[str, int] = {m["email"]: 0 for m in members}
    assigned: List[TicketDict] = []

    for ticket in tickets:
        required_role = ticket.get("required_role", "")

        # Step 1 – find role-matching members
        matching = [m for m in members if _role_matches(m["role"], required_role)]

        if matching:
            pool = matching
        else:
            # Fallback: project leads first, then everyone
            pool = [m for m in members if "lead" in _normalize(m["role"])] or members

        # Step 2 & 3 – prefer under-cap, then least loaded
        under_cap = [m for m in pool if load[m["email"]] < MAX_TASKS_PER_PERSON]
        candidates = under_cap if under_cap else pool
        best = min(candidates, key=lambda m: load[m["email"]])

        load[best["email"]] += 1

        result = dict(ticket)
        result["assigned_to"] = best["email"]

        print(
            f"  ✅  [{ticket.get('priority','?').upper()}] '{ticket['title'][:55]}'\n"
            f"       needs={required_role!r}  →  {best['name']} <{best['email']}>"
            f"  (load: {load[best['email']]})"
        )
        assigned.append(result)

    return assigned


# ─────────────────────────────────────────────────────────────────
# Agent 1 – Sprint Planner  (LangGraph node)
# ─────────────────────────────────────────────────────────────────

def plan_sprint(state: SprintState) -> dict:
    """
    Phase 1 – LLM generates tickets tagged with *required_role* only.
    Phase 2 – Python assignment engine maps roles → people with load balancing.
    """
    members = state.get("member_roles", [])
    role_list = sorted({m["role"] for m in members})
    roles_str = "\n".join(f"- {r}" for r in role_list)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a Tech Lead generating sprint tickets.\n\n"
            "AVAILABLE ROLES IN THIS TEAM:\n{roles}\n\n"
            "Rules:\n"
            "• Set 'required_role' to EXACTLY one of the role names listed above "
            "(the role best suited to implement the task).\n"
            "• Do NOT mention any person's name or email — only the role.\n"
            "• Create 2-8 tasks depending on scope (small=2-3, medium=3-5, large=5-8).\n\n"
            "OUTPUT ONLY a JSON list of objects with these keys:\n"
            "  title         – short ticket title\n"
            "  description   – 1-2 sentence description\n"
            "  priority      – high | medium | low\n"
            "  required_role – one of the roles listed above\n",
        ),
        ("human", "{goal}"),
    ])

    response = llm.invoke(prompt.format_messages(roles=roles_str, goal=state["goal"]))

    # ── Safe JSON extraction ─────────────────────────────────────
    content = response.content.strip()
    print(f"\n[Planner] LLM response: {len(content)} chars")

    for fence in ("```json", "```"):
        if fence in content:
            content = content.split(fence)[1].split("```")[0].strip()
            break

    if not (content.startswith("[") and content.endswith("]")):
        s, e = content.find("["), content.rfind("]")
        if s != -1 and e != -1:
            content = content[s : e + 1]

    try:
        raw_tickets: List[dict] = json.loads(content)
        print(f"[Planner] Parsed {len(raw_tickets)} tickets")
    except Exception as exc:
        print(f"[Planner] JSON parse error: {exc}\nRaw: {content}")
        raw_tickets = []

    # ── Smart assignment ─────────────────────────────────────────
    print("\n[Assigner] Assigning tickets …")
    tickets = assign_tickets(raw_tickets, members)

    # ── Sprint duration heuristic ────────────────────────────────
    score_map = {"high": 3, "medium": 2, "low": 1}
    total_score = sum(score_map.get(t.get("priority", "medium").lower(), 2) for t in tickets)
    sprint_days = max(min(total_score, 14), 1)

    return {"tickets": tickets, "sprint_days": sprint_days}


# ── LangGraph wiring ─────────────────────────────────────────────

_workflow = StateGraph(SprintState)
_workflow.add_node("planner", plan_sprint)
_workflow.set_entry_point("planner")
_workflow.add_edge("planner", END)
sprint_executor = _workflow.compile()


async def generate_sprint_tickets(goal: str, member_roles: List[dict]) -> dict:
    """
    Public entry point called from main.py.

    member_roles format:
        [{"name": str, "email": str, "role": str}, ...]
    """
    return await sprint_executor.ainvoke(
        {"goal": goal, "tickets": [], "sprint_days": 0, "member_roles": member_roles}
    )


# ─────────────────────────────────────────────────────────────────
# Agent 2 – Comment Assistant  (LangChain)
# ─────────────────────────────────────────────────────────────────

async def comment_assistant_help(ticket_context: str, user_question: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an AI project management assistant. "
            "Use the following ticket context to answer the user's question.\n"
            "Context: {context}",
        ),
        ("human", "{question}"),
    ])
    response = await llm.ainvoke(
        prompt.format_messages(context=ticket_context, question=user_question)
    )
    return response.content


async def comment_assistant_edit(original_comment: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a professional technical communicator. "
            "Rewrite the following rough comment to be professional, clear, and action-oriented. "
            "Keep it concise. Output ONLY the rewritten comment.",
        ),
        ("human", "{comment}"),
    ])
    response = await llm.ainvoke(prompt.format_messages(comment=original_comment))
    return response.content


# ─────────────────────────────────────────────────────────────────
# Agent 3 – Sprint Risk Detector
# ─────────────────────────────────────────────────────────────────

async def analyze_sprint_risks(tickets_json: str, current_date: str) -> list:
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are a Sprint Risk Analyzer. Analyze the provided list of sprint tickets and identify risks.\n"
            "IMPORTANT: Use the Current Date as a reference for overdue tasks.\n"
            "Categorize each ticket: risk_level = 'high' | 'medium' | 'low'.\n"
            "Provide 1-3 concise reasons and exactly one suggested_action per risky ticket.\n"
            "OUTPUT ONLY a JSON list of objects with keys: "
            "ticket_id, risk_level, reasons (list of strings), suggested_action.\n"
            "Current Date: {current_date}",
        ),
        ("human", "{tickets}"),
    ])

    response = await llm.ainvoke(
        prompt.format_messages(tickets=tickets_json, current_date=current_date)
    )

    content = response.content.strip()
    for fence in ("```json", "```"):
        if content.startswith(fence):
            content = content[len(fence) :].rsplit("```", 1)[0].strip()
            break

    try:
        return json.loads(content)
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────
# Smoke test  (python agent.py)
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    TEAM = [
        {"name": "Alice",  "email": "alice@co.com",  "role": "Backend Developer"},
        {"name": "Bob",    "email": "bob@co.com",    "role": "Backend Developer"},
        {"name": "Carol",  "email": "carol@co.com",  "role": "Frontend Developer"},
        {"name": "Dave",   "email": "dave@co.com",   "role": "UI/UX Designer"},
        {"name": "Eve",    "email": "eve@co.com",    "role": "Project Lead"},
        {"name": "Frank",  "email": "frank@co.com",  "role": "QA Engineer"},
    ]

    GOAL = (
        "Build a user authentication system: REST APIs for login/signup, "
        "a React login page with form validation, and end-to-end Playwright tests."
    )

    async def run():
        result = await generate_sprint_tickets(GOAL, TEAM)
        print("\n\n══════════ FINAL SPRINT PLAN ══════════")
        print(f"Sprint Days : {result['sprint_days']}")
        for i, t in enumerate(result["tickets"], 1):
            print(
                f"\n[{i}] {t['title']}\n"
                f"     Priority     : {t['priority']}\n"
                f"     Required Role: {t.get('required_role', 'N/A')}\n"
                f"     Assigned To  : {t['assigned_to']}\n"
                f"     Description  : {t['description']}"
            )

    asyncio.run(run())