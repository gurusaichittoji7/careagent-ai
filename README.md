# 🩺 CareAgent - Multi-Agent AI Health Reasoning Assistant

> Ask any health question → get a smart follow up → watch 4 specialized AI agents reason step by step

Built for the **Microsoft Agents League Hackathon 2026** Reasoning Agents Track

---

## 🎯 The Problem

Most AI health tools give a one shot answer with no transparency. Users don't know *how* the answer was reached, *how confident* the AI is, or *how serious* their situation is.

## ✅ The Solution

CareAgent uses a **5 step multi agent pipeline** that thinks like a doctor:

1. Asks one smart clarifying question first
2. Runs 4 specialized agents in sequence
3. Shows each agent's reasoning live as it streams
4. Displays severity level and confidence scores
5. Triggers emergency alert with 911 button if needed

---

## 🤖 Agent Pipeline
User Question
↓
Agent 0: Interviewer--> asks one clarifying question
↓
Agent 1: Symptom Classifier--> identifies symptoms and body system
↓
Agent 2: Risk Assessor--> severity level + possible conditions
↓
Agent 3: Recommendation Generator--> immediate steps + home remedies
↓
Agent 4: Safety Checker--> flags dangers + drug interactions
↓
Confidence Scores + Severity Badge

---

## ✨ Key Features

- 🧠 **Multi-agent reasoning** — 4 specialized agents, not one generic LLM call
- 🔴 **Severity detection** — Low / Moderate / High / Emergency
- 🚨 **Emergency mode** — pulsing red alert with direct 911 call button
- 📊 **Confidence scores** — each agent shows its confidence percentage
- ⚡ **Live streaming** — watch agents think in real time
- 🤔 **Smart clarifying questions** — gathers context before reasoning
- 🎨 **Clean UI** — anyone can use it without training

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| LLM | Groq API (llama-3.3-70b-versatile) |
| AI Dev Tool | GitHub Copilot (Microsoft) |
| Streaming | FastAPI StreamingResponse |

---

## 🚀 Run Locally
### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your GROQ_API_KEY
venv/bin/uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## 📁 Project Structure

careagent-ai/
├── backend/
│   ├── main.py          #FastAPI endpoints + streaming
│   ├── agent.py         # 5-agent pipeline logic
│   ├── .env.example     # API key template
│   └── requirements.txt
├── frontend/
│   └── src/
│       └── App.jsx      # React UI with live streaming
├── assets/              # Screenshots
└── README.md

---

## 🧠 How Reasoning Works

Unlike a standard chatbot, CareAgent chains specialized agents where **each agent builds on the previous one's output**:

- Classifier output → feeds into Risk Assessor
- Risk output → feeds into Recommendation Generator  
- Recommendation → feeds into Safety Checker

This mirrors clinical reasoning workflows used by real healthcare professionals.

---

## ⚠️ Disclaimer

CareAgent is not a substitute for professional medical advice. Always consult a qualified healthcare provider for diagnosis and treatment. In emergencies, call 911 immediately.