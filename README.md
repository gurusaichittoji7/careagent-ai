# 🩺 CareAgent — AI Health Reasoning Assistant

> Ask any health question and get a step-by-step reasoned answer — powered by Groq LLM and GitHub Copilot

---

## 🎯 What It Does

CareAgent is an AI-powered health reasoning assistant that thinks out loud. Instead of just giving a quick answer, it breaks down the reasoning process step by step — so users can understand *why* the answer makes sense.

Built for the **Microsoft Agents League Hackathon 2026** under the **Reasoning Agents** track.

---

## 🧠 How It Works
User asks a health question
↓
FastAPI Backend receives the request
↓
Groq LLM reasons step by step
↓
Returns structured: Reasoning → Answer → Important Note

---

## ✨ Features

- 🧠 **Step-by-step reasoning** — shows how the answer was reached
- ✅ **Clean answer card** — highlights the final recommendation
- ⚠️ **Safety note** — always reminds users to consult a doctor
- ⚡ **Fast responses** — powered by Groq's ultra-fast inference
- 🎨 **Simple UI** — anyone can use it without training

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| LLM | Groq API (llama-3.3-70b-versatile) |
| AI Dev Tool | GitHub Copilot (Microsoft) |

---

## 🚀 Run Locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your GROQ_API_KEY
uvicorn main:app --reload
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
│   ├── main.py          # FastAPI endpoints
│   ├── agent.py         # Groq LLM reasoning logic
│   └── requirements.txt
├── frontend/
│   └── src/
│       └── App.jsx      # React UI
└── README.md

---

## ⚠️ Disclaimer

CareAgent is not a substitute for professional medical advice. Always consult a qualified healthcare provider for diagnosis and treatment.