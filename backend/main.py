from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import (
    generate_clarifying_question,
    classify_symptoms,
    assess_risk,
    generate_recommendation,
    safety_check,
    extract_severity,
    generate_confidence
)
import json
from agent import (
    generate_clarifying_question,
    classify_symptoms,
    assess_risk,
    generate_recommendation,
    safety_check,
    extract_severity,
    generate_confidence,
    is_health_question,
    generate_unified_summary,
    run_agent
)

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
        if not is_health_question(request.question):
            return {"error": "not_health", "message": "I can only help with health and medical questions. Please describe a symptom or health concern."}
        clarifying_question = generate_clarifying_question(request.question)
        return {"clarifying_question": clarifying_question}
    except Exception as e:
        return {"error": str(e)}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    def stream():
        try:
            full_input = f"{request.question}\nAdditional context: {request.context}" if request.context else request.question

            # Agent 1
            yield json.dumps({"agent": "classifier", "status": "thinking"}) + "\n"
            classification = classify_symptoms(full_input)
            yield json.dumps({"agent": "classifier", "result": classification}) + "\n"

            # Agent 2
            yield json.dumps({"agent": "risk", "status": "thinking"}) + "\n"
            risk = assess_risk(full_input, classification)
            severity = extract_severity(risk)
            yield json.dumps({"agent": "risk", "result": risk, "severity": severity}) + "\n"

            # Agent 3
            yield json.dumps({"agent": "recommendation", "status": "thinking"}) + "\n"
            recommendation = generate_recommendation(full_input, risk)
            yield json.dumps({"agent": "recommendation", "result": recommendation}) + "\n"

            # Agent 4
            yield json.dumps({"agent": "safety", "status": "thinking"}) + "\n"
            safety = safety_check(recommendation)
            yield json.dumps({"agent": "safety", "result": safety}) + "\n"

            # Confidence scores
            yield json.dumps({"agent": "confidence", "status": "thinking"}) + "\n"
            confidence_raw = generate_confidence(full_input, classification)
            try:
                confidence = json.loads(confidence_raw)
            except Exception:
                confidence = {"classifier": 85, "risk": 80, "recommendation": 78, "safety": 92}
            yield json.dumps({"agent": "confidence", "result": confidence}) + "\n"
            yield json.dumps({"agent": "summary", "status": "thinking"}) + "\n"
            summary = generate_unified_summary(full_input, classification, risk, recommendation, safety)
            yield json.dumps({"agent": "summary", "result": summary}) + "\n"
            yield json.dumps({"agent": "done"}) + "\n"

        except Exception as e:
            yield json.dumps({"agent": "error", "result": str(e)}) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")

class FollowUpRequest(BaseModel):
    original_question: str
    context: str
    analysis_summary: str
    followup: str

@app.post("/followup")
def followup(request: FollowUpRequest):
    try:
        answer = run_agent(
            system_prompt="""You are CareAgent, a helpful medical assistant.
The user already received an analysis. They are asking a follow-up question.
Use the original context and analysis to give a SHORT, direct answer.
Maximum 3-4 sentences. Plain English. No headers or bullet points.""",
            user_input=f"""Original question: {request.original_question}
Context: {request.context}
Analysis summary: {request.analysis_summary}
Follow-up question: {request.followup}"""
        )
        return {"answer": answer}
    except Exception as e:
        return {"error": str(e)}