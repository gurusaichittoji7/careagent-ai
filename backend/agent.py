from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

def generate_clarifying_question(question: str) -> str:
    return run_agent(
        system_prompt="""You are a medical interviewer assistant.
Given a user's health question, generate ONE smart follow-up question to better understand their situation.

Rules:
- Ask only ONE question
- Keep it short and conversational
- Focus on duration, severity, or accompanying symptoms
- Never diagnose
- Return only the question, nothing else""",
        user_input=question
    )


def run_agent(system_prompt: str, user_input: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ],
        temperature=0.3,
        max_tokens=512
    )
    return response.choices[0].message.content.strip()


def classify_symptoms(question: str) -> str:
    return run_agent(
        system_prompt="""You are a medical symptom classifier.
Given a user's health question, identify:
1. Primary symptom(s)
2. Affected body system (e.g. respiratory, cardiovascular, digestive)
3. Symptom duration clues if mentioned

Respond in this format:
- Primary Symptoms: ...
- Body System: ...
- Duration Clues: ...
""",
        user_input=question
    )


def assess_risk(question: str, classification: str) -> str:
    return run_agent(
        system_prompt="""You are a medical risk assessor.
Given symptom classification, evaluate:
1. Severity level: Low / Moderate / High / Emergency
2. Possible conditions (top 3)
3. Red flags to watch for

Respond in this format:
- Severity: ...
- Possible Conditions: ...
- Red Flags: ...
""",
        user_input=f"Question: {question}\nClassification: {classification}"
    )


def generate_recommendation(question: str, risk: str) -> str:
    return run_agent(
        system_prompt="""You are a medical recommendation specialist.
Based on risk assessment, provide:
1. Immediate steps to take
2. Home remedies if applicable
3. When to see a doctor

Be practical, clear, and concise.""",
        user_input=f"Question: {question}\nRisk Assessment: {risk}"
    )


def safety_check(recommendation: str) -> str:
    return run_agent(
        system_prompt="""You are a medical safety checker.
Review the recommendation and:
1. Flag anything potentially dangerous
2. Add any important drug interaction warnings if relevant
3. Add a final disclaimer

Be brief and focused on safety only.""",
        user_input=recommendation
    )


def run_pipeline(question: str, context: str = "") -> dict:
    full_input = f"{question}\nAdditional context: {context}" if context else question

    classification = classify_symptoms(full_input)
    risk = assess_risk(full_input, classification)
    recommendation = generate_recommendation(full_input, risk)
    safety = safety_check(recommendation)

    return {
        "classification": classification,
        "risk": risk,
        "recommendation": recommendation,
        "safety": safety
    }