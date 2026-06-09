from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are CareAgent, an AI health reasoning assistant.
When a user asks a health question, think step by step.
Format your response exactly like this:

**Reasoning:**
Step 1: ...
Step 2: ...
Step 3: ...

**Answer:**
Your final clear answer here.

**Important Note:**
Always remind users to consult a doctor for serious concerns."""


def ask_careagent(question: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question}
        ],
        temperature=0.3,
        max_tokens=1024
    )
    return response.choices[0].message.content