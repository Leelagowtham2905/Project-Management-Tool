# SprintMind - AI Project Management Tool

SprintMind is a modern, AI-powered project management application designed for agile teams. It features a premium "Linear-style" interface, drag-and-drop Kanban boards, and an integrated AI assistant for sprint planning and ticket refining.

## 🚀 Features
- **Premium Dark UI**: Glassmorphism and modern animations.
- **AI Sprint Planner**: Automatically generate tickets from high-level goals.
- **AI Assistant**: Get help refining tickets or generating comments.
- **Kanban Board**: intuitive drag-and-drop task management.
- **Cross-Project Views**: "My Issues" and "Inbox" for staying organized.

## 🏗️ Tech Stack
- **Frontend**: React, Vanilla CSS.
- **Backend**: FastAPI, SQLAlchemy, SQLite.
- **AI**: Google Gemini (LangChain/LangGraph).

## 🛠️ Setup Instructions
1. Install dependencies:
   - Backend: `pip install -r backend/requirements.txt`
   - Frontend: `npm install`
2. Set up `.env` with your `GEMINI_API_KEY`.
3. Start the application:
   - Backend: `uvicorn main:app --reload` (inside `backend`)
   - Frontend: `npm run dev` (inside `frontend`)
