from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import classify_symptoms, assess_risk, generate_recommendation, safety_check
import json

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
    return {"status": "CareAgent 2.0 is running"}

@app.post("/ask")
def ask(request: QuestionRequest):
    question = request.question.strip()
    if not question:
        return {"error": "Question cannot be empty"}

    def stream():
        try:
            # Agent 1
            yield json.dumps({"agent": "classifier", "status": "thinking"}) + "\n"
            classification = classify_symptoms(question)
            yield json.dumps({"agent": "classifier", "result": classification}) + "\n"

            # Agent 2
            yield json.dumps({"agent": "risk", "status": "thinking"}) + "\n"
            risk = assess_risk(question, classification)
            yield json.dumps({"agent": "risk", "result": risk}) + "\n"

            # Agent 3
            yield json.dumps({"agent": "recommendation", "status": "thinking"}) + "\n"
            recommendation = generate_recommendation(question, risk)
            yield json.dumps({"agent": "recommendation", "result": recommendation}) + "\n"

            # Agent 4
            yield json.dumps({"agent": "safety", "status": "thinking"}) + "\n"
            safety = safety_check(recommendation)
            yield json.dumps({"agent": "safety", "result": safety}) + "\n"

            yield json.dumps({"agent": "done"}) + "\n"

        except Exception as e:
            yield json.dumps({"agent": "error", "result": str(e)}) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")