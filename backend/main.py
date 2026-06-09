from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import ask_careagent

app = FastAPI(title="CareAgent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

@app.get("/")
def root():
    return {"status": "CareAgent is running"}

@app.post("/ask")
def ask(request: QuestionRequest):
    try:
        if not request.question.strip():
            return {"error": "Question cannot be empty"}
        answer = ask_careagent(request.question)
        return {"answer": answer}
    except Exception as e:
        print(f"ERROR: {e}")
        return {"error": str(e)}