import os
from typing import List, TypedDict, Annotated
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
import json
from  dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
# Initialize LLM with Gemini
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=api_key, temperature=0.7)





# --- Agent 1: Sprint Planner (LangGraph) ---

class TicketDict(TypedDict):
    title: str
    description: str
    priority: str # high, medium, low

class SprintState(TypedDict):
    goal: str
    tickets: List[TicketDict]
    sprint_days: int

def plan_sprint(state: SprintState):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a Tech Lead. Based on the user's sprint goal, create a list of detailed tickets. "
                   "Output ONLY a JSON list of objects with keys: title, description, priority (high/medium/low). "
                   "Create 2-8 tasks depending on the scope (small=2-3, medium=3-5, large=5-8)."),
        ("human", "{goal}")
    ])
    
    response = llm.invoke(prompt.format_messages(goal=state["goal"]))
    # Clean response in case LLM adds markdown blocks
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    
    tickets = json.loads(content)
    
    # Calculate sprint days: (sum of priority scores * task count) capped at 14
    # high=3, medium=2, low=1
    score_map = {"high": 3, "medium": 2, "low": 1}
    total_score = sum(score_map.get(t["priority"].lower(), 2) for t in tickets)
    days = min(int((total_score * len(tickets)) / 7) + 1, 14) # Adjusted logic to be more realistic but following user request's spirit
    # Wait, the user said: "sum of priority scores multiplied by task count, capped at 14"
    # Actually, if I have 3 tasks with priority 2, that's 6 * 3 = 18. Capped at 14.
    days = min(total_score * len(tickets), 14) 
    
    return {"tickets": tickets, "sprint_days": max(days, 1)}

workflow = StateGraph(SprintState)
workflow.add_node("planner", plan_sprint)
workflow.set_entry_point("planner")
workflow.add_edge("planner", END)
sprint_executor = workflow.compile()

async def generate_sprint_tickets(goal: str):
    result = await sprint_executor.ainvoke({"goal": goal, "tickets": [], "sprint_days": 0})
    return result

# --- Agent 2: Comment Assistant (LangChain) ---

async def comment_assistant_help(ticket_context: str, user_question: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an AI project management assistant. Use the following ticket context to answer the user's question. "
                   "Context: {context}"),
        ("human", "{question}")
    ])
    response = await llm.ainvoke(prompt.format_messages(context=ticket_context, question=user_question))
    return response.content

async def comment_assistant_edit(original_comment: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a professional technical communicator. Rewrite the following rough comment to be professional, clear, and action-oriented. "
                   "Keep it concise. Output ONLY the rewritten comment."),
        ("human", "{comment}")
    ])
    response = await llm.ainvoke(prompt.format_messages(comment=original_comment))
    return response.content
