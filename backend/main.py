from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import (
    generate_clarifying_question,
    classify_symptoms,
    assess_risk,
    generate_recommendation,
    safety_check
)
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

class AnalyzeRequest(BaseModel):
    question: str
    context: str = ""

@app.get("/")
def root():
    return {"status": "CareAgent 2.0 is running"}

@app.post("/clarify")
def clarify(request: QuestionRequest):
    try:
        clarifying_question = generate_clarifying_question(request.question)
        return {"clarifying_question": clarifying_question}
    except Exception as e:
        return {"error": str(e)}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    def stream():
        try:
            full_input = f"{request.question}\nAdditional context: {request.context}" if request.context else request.question

            yield json.dumps({"agent": "classifier", "status": "thinking"}) + "\n"
            classification = classify_symptoms(full_input)
            yield json.dumps({"agent": "classifier", "result": classification}) + "\n"

            yield json.dumps({"agent": "risk", "status": "thinking"}) + "\n"
            risk = assess_risk(full_input, classification)
            yield json.dumps({"agent": "risk", "result": risk}) + "\n"

            yield json.dumps({"agent": "recommendation", "status": "thinking"}) + "\n"
            recommendation = generate_recommendation(full_input, risk)
            yield json.dumps({"agent": "recommendation", "result": recommendation}) + "\n"

            yield json.dumps({"agent": "safety", "status": "thinking"}) + "\n"
            safety = safety_check(recommendation)
            yield json.dumps({"agent": "safety", "result": safety}) + "\n"

            yield json.dumps({"agent": "done"}) + "\n"

        except Exception as e:
            yield json.dumps({"agent": "error", "result": str(e)}) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")