import { useState } from "react";
import jsPDF from "jspdf";
import { TypeAnimation } from "react-type-animation";

const STORAGE_KEY = "careagent_history";

const loadPersistedHistory = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const savePersistedHistory = (items) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
};

const detectPatterns = (historyItems) => {
  if (historyItems.length < 2) return [];
  const patterns = [];
  const recentSeverities = historyItems.slice(0, 5).map(h => h.severity);
  const severityOrder = { Low: 1, Moderate: 2, High: 3, Emergency: 4 };
  const escalating = recentSeverities.length >= 2 &&
    (severityOrder[recentSeverities[0]] || 0) > (severityOrder[recentSeverities[1]] || 0);
  if (escalating) patterns.push({ type: "warning", message: `⚠️ Severity escalating: ${recentSeverities[1]} → ${recentSeverities[0]}` });
  const words = historyItems.map(h => h.question.toLowerCase());
  const symptomKeywords = ["headache", "pain", "fever", "cough", "nausea", "dizzy", "fatigue", "chest"];
  symptomKeywords.forEach(symptom => {
    const count = words.filter(w => w.includes(symptom)).length;
    if (count >= 2) patterns.push({ type: "repeat", message: `🔁 "${symptom}" reported ${count} times recently` });
  });
  const highCount = historyItems.filter(h => h.severity === "High" || h.severity === "Emergency").length;
  if (highCount >= 2) patterns.push({ type: "danger", message: `🚨 ${highCount} high/emergency severity cases recorded` });
  return patterns.slice(0, 3);
};

const getWorseningAlert = (currentSeverity, historyItems) => {
  if (!currentSeverity || historyItems.length === 0) return null;
  const severityOrder = { Low: 1, Moderate: 2, High: 3, Emergency: 4 };
  const lastSeverity = historyItems[0]?.severity;
  if (!lastSeverity) return null;
  const current = severityOrder[currentSeverity] || 0;
  const last = severityOrder[lastSeverity] || 0;
  if (current > last) {
    return {
      type: "worsening",
      message: `⚠️ Your symptoms appear worse than last time (${lastSeverity} → ${currentSeverity}). Consider seeing a doctor.`
    };
  }
  if (current < last) {
    return {
      type: "improving",
      message: `✅ Good news! Your symptoms appear to be improving (${lastSeverity} → ${currentSeverity}).`
    };
  }
  return null;
};

const calculateHealthScore = (sev, conf) => {
  if (!sev) return null;
  const severityPenalty = { Low: 0, Moderate: 20, High: 40, Emergency: 70 };
  const avgConfidence = conf
    ? (conf.classifier + conf.risk + conf.recommendation + conf.safety) / 4
    : 80;
  const base = 100 - (severityPenalty[sev] || 0);
  const score = Math.round(base * (avgConfidence / 100));
  return Math.max(10, Math.min(99, score));
};

const AGENTS = [
  { key: "classifier", icon: "🔍", label: "Classify" },
  { key: "risk", icon: "⚠️", label: "Risk" },
  { key: "recommendation", icon: "💊", label: "Recommend" },
  { key: "safety", icon: "🛡️", label: "Safety" },
];

const STEPS = {
  INPUT: "input", CLARIFYING: "clarifying", CONTEXT: "context",
  ANALYZING: "analyzing", DONE: "done",
};

const SEVERITY_CONFIG = {
  Low: { color: "text-green-600", bg: "bg-green-50 border-green-200", dot: "bg-green-500", dotColor: "bg-green-500" },
  Moderate: { color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", dotColor: "bg-yellow-500" },
  High: { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500", dotColor: "bg-orange-500" },
  Emergency: { color: "text-red-600", bg: "bg-red-50 border-red-300", dot: "bg-red-500", dotColor: "bg-red-500" },
};

function SeverityGauge({ severity }) {
  const levels = { Low: 1, Moderate: 2, High: 3, Emergency: 4 };
  const colors = { Low: "#22c55e", Moderate: "#eab308", High: "#f97316", Emergency: "#ef4444" };
  const level = levels[severity] || 0;
  const color = colors[severity] || "#6b7280";
  const percentage = (level / 4) * 100;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10"
            strokeDasharray="188 251" strokeLinecap="round" className="dark:stroke-gray-700" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${(percentage / 100) * 188} 251`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{level}/4</span>
          <span className="text-xs font-semibold" style={{ color }}>{severity}</span>
        </div>
      </div>
      <div className="flex gap-2 text-xs">
        <span className="text-green-500 font-medium">Low</span>
        <span className="text-gray-300">·</span>
        <span className="text-yellow-500 font-medium">Moderate</span>
        <span className="text-gray-300">·</span>
        <span className="text-orange-500 font-medium">High</span>
        <span className="text-gray-300">·</span>
        <span className="text-red-500 font-medium">Emergency</span>
      </div>
    </div>
  );
}

function AgentTimeline({ agentStates }) {
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      {AGENTS.map((agent, i) => {
        const state = agentStates[agent.key];
        const isThinking = state?.status === "thinking" && !state?.result;
        const isDone = !!state?.result;
        return (
          <div key={agent.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all duration-500
                ${isDone ? "border-blue-500 bg-blue-50 dark:bg-blue-950" :
                  isThinking ? "border-blue-300 bg-blue-50 dark:bg-blue-900 animate-pulse" :
                  "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"}`}>
                {agent.icon}
              </div>
              <span className={`text-xs font-medium transition-colors
                ${isDone ? "text-blue-600 dark:text-blue-400" :
                  isThinking ? "text-blue-400 animate-pulse" : "text-gray-400"}`}>
                {agent.label}
              </span>
            </div>
            {i < AGENTS.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 transition-all duration-700
                ${isDone ? "bg-blue-400" : "bg-gray-200 dark:bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function HealthScore({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 55 ? "#eab308" : score >= 35 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "Good" : score >= 55 ? "Moderate" : score >= 35 ? "Poor" : "Critical";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb"
            strokeWidth="10" className="dark:stroke-gray-700" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.5s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs font-semibold text-gray-400">/100</span>
        </div>
      </div>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

function ConfidenceBar({ label, score }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-24 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${score || 0}%` }} />
      </div>
      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 w-8">{score}%</span>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [question, setQuestion] = useState("");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [context, setContext] = useState("");
  const [agentStates, setAgentStates] = useState({});
  const [severity, setSeverity] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [step, setStep] = useState(STEPS.INPUT);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState(loadPersistedHistory);
  const [notHealthMsg, setNotHealthMsg] = useState("");
  const [unifiedAnswer, setUnifiedAnswer] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpMessages, setFollowUpMessages] = useState([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const startListening = (setter) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome for voice input."); return; }
    const r = new SR();
    r.lang = "en-US";
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onresult = (e) => setter(e.results[0][0].transcript);
    r.onerror = () => setListening(false);
    r.start();
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setStep(STEPS.CLARIFYING);
    setAgentStates({});
    setSeverity(null);
    setConfidence(null);
    setUnifiedAnswer("");
    setClarifyingQuestion("");
    setContext("");
    setNotHealthMsg("");
    try {
      const res = await fetch("http://localhost:8000/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (data.error === "not_health") {
        setStep(STEPS.INPUT);
        setNotHealthMsg(data.message);
        return;
      }
      setClarifyingQuestion(data.clarifying_question);
      setStep(STEPS.CONTEXT);
    } catch {
      alert("Backend error. Is it running?");
      setStep(STEPS.INPUT);
    }
  };

  const handleAnalyze = async () => {
    setStep(STEPS.ANALYZING);
    setAgentStates({});
    setSeverity(null);
    setConfidence(null);
    setUnifiedAnswer("");
    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestStates = {};
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.agent === "done") {
              setStep(STEPS.DONE);
            } else if (data.agent === "confidence" && data.result) {
              setConfidence(data.result);
            } else if (data.agent === "summary" && data.result) {
              setUnifiedAnswer(data.result);
            } else if (data.agent === "risk" && data.severity) {
              setSeverity(data.severity);
              latestStates = { ...latestStates, risk: { status: data.status || "done", result: data.result } };
              setAgentStates({ ...latestStates });
            } else if (data.agent && data.agent !== "error") {
              latestStates = { ...latestStates, [data.agent]: { status: data.status || "done", result: data.result || latestStates[data.agent]?.result } };
              setAgentStates({ ...latestStates });
            }
          } catch {}
        }
      }
    } catch {
      alert("Something went wrong.");
      setStep(STEPS.INPUT);
    }
  };

  const handleReset = () => {
    if (step === STEPS.DONE && question) {
      const newEntry = {
        question, context, severity, confidence, agentStates, unifiedAnswer,
        timestamp: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        fullDate: new Date().toISOString(),
      };
      const updated = [newEntry, ...history];
      setHistory(updated);
      savePersistedHistory(updated);
    }
    setStep(STEPS.INPUT);
    setQuestion("");
    setClarifyingQuestion("");
    setContext("");
    setAgentStates({});
    setSeverity(null);
    setConfidence(null);
    setUnifiedAnswer("");
    setNotHealthMsg("");
    setFollowUpMessages([]);
    setFollowUpInput("");
  };

  const loadFromHistory = (item) => {
    setQuestion(item.question);
    setContext(item.context);
    setSeverity(item.severity);
    setConfidence(item.confidence);
    setAgentStates(item.agentStates);
    setUnifiedAnswer(item.unifiedAnswer || "");
    setClarifyingQuestion("");
    setStep(STEPS.DONE);
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || followUpLoading) return;
    const userMsg = followUpInput.trim();
    setFollowUpInput("");
    setFollowUpMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setFollowUpLoading(true);
    try {
      const res = await fetch("http://localhost:8000/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_question: question, context, analysis_summary: unifiedAnswer, followup: userMsg }),
      });
      const data = await res.json();
      setFollowUpMessages((prev) => [...prev, { role: "agent", text: data.answer || "Sorry, something went wrong." }]);
    } catch {
      setFollowUpMessages((prev) => [...prev, { role: "agent", text: "Connection error." }]);
    }
    setFollowUpLoading(false);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;
    const addText = (text, size = 11, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text || "", maxWidth);
      lines.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += size * 0.5 + 2;
      });
      y += 2;
    };
    const addSection = (title, content) => {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(240, 245, 255);
      doc.rect(margin - 2, y - 5, maxWidth + 4, 9, "F");
      doc.setTextColor(30, 80, 200);
      addText(title, 12, true);
      doc.setTextColor(30, 30, 30);
      const clean = content?.replace(/\*\*/g, "").replace(/#+/g, "").trim();
      addText(clean, 10);
      y += 4;
    };
    doc.setFillColor(10, 20, 80);
    doc.rect(0, 0, pageWidth, 35, "F");
    doc.setTextColor(100, 160, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CareAgent", margin, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 220);
    doc.text("AI Health Reasoning Report", margin, 24);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);
    y = 45;
    doc.setTextColor(30, 30, 30);
    if (severity) addText(`Severity Level: ${severity}`, 13, true);
    addText(`Question: ${question}`, 11, true);
    if (context) addText(`Additional Context: ${context}`, 10);
    y += 4;
    addSection("SYMPTOM CLASSIFICATION", agentStates.classifier?.result);
    addSection("RISK ASSESSMENT", agentStates.risk?.result);
    addSection("RECOMMENDATIONS", agentStates.recommendation?.result);
    addSection("SAFETY NOTES", agentStates.safety?.result);
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("CareAgent is not a substitute for professional medical advice. Always consult a doctor.", margin, 290);
    }
    doc.save(`careagent-report-${Date.now()}.pdf`);
  };

  const sev = severity ? SEVERITY_CONFIG[severity] : null;

  const renderUnifiedAnswer = () => {
    if (!unifiedAnswer) return null;
    const lines = unifiedAnswer.split(/\n/).map(s => s.trim()).filter(Boolean);
    const intro = lines.find(l => !l.startsWith("•"));
    const bullets = lines.filter(l => l.startsWith("•")).map(l => l.replace("•", "").trim());
    const footerLines = lines.filter(l => !l.startsWith("•") && l !== intro);
    const footer = footerLines.join(" ");
    return (
      <div className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed space-y-3">
        {intro && <TypeAnimation sequence={[intro]} speed={70} cursor={false} wrapper="p" />}
        {bullets.length > 0 && (
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {footer && (
          <p className="text-gray-500 dark:text-gray-400 text-xs border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
            ⚠️ {footer}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex transition-colors duration-300">

        {/* Sidebar */}
        <div className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 gap-3 min-h-screen shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest font-semibold">🕐 History</p>
            {history.length > 0 && (
              <button onClick={() => { setHistory([]); savePersistedHistory([]); }}
                className="text-xs text-red-400 hover:text-red-600 transition">
                Clear
              </button>
            )}
          </div>

          {/* Pattern Alerts */}
          {detectPatterns(history).map((p, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-xs font-medium border
              ${p.type === "danger" ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-300" :
                p.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-300" :
                "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"}`}>
              {p.message}
            </div>
          ))}

          {/* Timeline */}
          {history.length === 0 && (
            <p className="text-gray-400 text-xs">No history yet. Ask a question to get started.</p>
          )}
          {history.length > 0 && (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="flex flex-col gap-4">
                {history.map((item, i) => (
                  <div key={i} onClick={() => loadFromHistory(item)} className="relative pl-8 cursor-pointer group">
                    <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 transition
                      ${item.severity === "Emergency" ? "bg-red-500" :
                        item.severity === "High" ? "bg-orange-500" :
                        item.severity === "Moderate" ? "bg-yellow-500" : "bg-green-500"}`} />
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 group-hover:border-blue-400 transition">
                      <p className="text-gray-800 dark:text-white text-xs font-semibold truncate">{item.question}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs font-semibold
                          ${item.severity === "Emergency" ? "text-red-500" :
                            item.severity === "High" ? "text-orange-500" :
                            item.severity === "Moderate" ? "text-yellow-500" : "text-green-500"}`}>
                          {item.severity || "Unknown"}
                        </span>
                        <span className="text-gray-400 text-xs">{item.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center px-4 py-10 overflow-y-auto">

          {/* Top bar */}
          <div className="w-full max-w-2xl flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">🩺 CareAgent</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Multi-agent AI health reasoning</p>
            </div>
            <button onClick={() => setDark(!dark)}
              className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:shadow transition font-medium text-gray-600 dark:text-gray-300">
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>

          <div className="w-full max-w-2xl flex flex-col gap-4">

            {/* Agent Timeline */}
            {(step === STEPS.ANALYZING || step === STEPS.DONE) && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm px-4">
                <AgentTimeline agentStates={agentStates} />
              </div>
            )}

            {/* Severity Gauge */}
            {sev && severity !== "Emergency" && (
              <div className={`rounded-2xl px-5 py-4 border flex items-center gap-6 ${sev.bg}`}>
                <SeverityGauge severity={severity} />
                <div>
                  <p className={`font-bold text-lg ${sev.color}`}>Severity: {severity}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Based on your symptoms and context</p>
                </div>
              </div>
            )}

            {/* Emergency Alert */}
            {severity === "Emergency" && (
              <div className="rounded-2xl border-2 border-red-400 bg-red-50 dark:bg-red-950 px-6 py-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl animate-bounce">🚨</span>
                  <span className="text-red-600 dark:text-red-300 font-black text-lg uppercase tracking-widest">Emergency Detected</span>
                </div>
                <p className="text-red-500 dark:text-red-200 text-sm mb-4">Your symptoms may require immediate medical attention. Do not wait.</p>
                <a href="tel:911" className="block w-full text-center bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition text-lg">
                  📞 Call 911 Now
                </a>
              </div>
            )}

            {/* Question Input */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">💬 Your Question</p>
              <textarea
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none transition"
                rows={3}
                placeholder="e.g. I have a severe headache and feel nauseous"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={step !== STEPS.INPUT}
              />
              {notHealthMsg && (
                <p className="mt-2 text-red-500 text-sm font-medium">⚠️ {notHealthMsg}</p>
              )}
              {step === STEPS.INPUT && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startListening(setQuestion)}
                    className={`py-3 px-4 rounded-xl border transition font-semibold text-sm
                      ${listening ? "bg-red-100 border-red-300 text-red-600 animate-pulse dark:bg-red-900 dark:text-red-300" :
                      "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`}>
                    🎤
                  </button>
                  <button onClick={handleAsk}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-sm">
                    Continue →
                  </button>
                </div>
              )}
            </div>

            {/* Clarifying Question */}
            {(step === STEPS.CLARIFYING || step === STEPS.CONTEXT || step === STEPS.ANALYZING || step === STEPS.DONE) && (
              <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900 rounded-2xl p-5 shadow-sm">
                <p className="text-blue-500 text-xs uppercase tracking-widest font-semibold mb-2">🤔 Follow-up Question</p>
                {step === STEPS.CLARIFYING ? (
                  <p className="text-gray-400 animate-pulse text-sm">Generating question...</p>
                ) : (
                  <>
                    <p className="text-gray-800 dark:text-white mb-3 font-medium">{clarifyingQuestion}</p>
                    <textarea
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none transition"
                      rows={2}
                      placeholder="Type your answer here..."
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      disabled={step !== STEPS.CONTEXT}
                    />
                    {step === STEPS.CONTEXT && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => startListening(setContext)}
                          className={`py-3 px-4 rounded-xl border transition font-semibold text-sm
                            ${listening ? "bg-red-100 border-red-300 text-red-600 animate-pulse dark:bg-red-900 dark:text-red-300" :
                            "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`}>
                          🎤
                        </button>
                        <button onClick={handleAnalyze}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-sm">
                          🧠 Analyze with All Agents
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Analyzing placeholder */}
            {step === STEPS.ANALYZING && Object.keys(agentStates).length === 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <p className="text-gray-400 animate-pulse text-sm text-center">Agents are reasoning...</p>
              </div>
            )}

            {/* Unified Answer */}
            {unifiedAnswer && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-blue-600 dark:text-blue-400 text-xs uppercase tracking-widest font-semibold">📋 Analysis & Recommendations</p>
                    {confidence && severity && (
                      <HealthScore score={calculateHealthScore(severity, confidence)} />
                )}
            </div>
                {renderUnifiedAnswer()}
                {confidence && (
                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-3">Agent Confidence</p>
                    <div className="flex flex-col gap-2">
                      <ConfidenceBar label="Classifier" score={confidence.classifier} />
                      <ConfidenceBar label="Risk" score={confidence.risk} />
                      <ConfidenceBar label="Recommend" score={confidence.recommendation} />
                      <ConfidenceBar label="Safety" score={confidence.safety} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(() => {
  const alert = getWorseningAlert(severity, history);
  if (!alert) return null;
  return (
    <div className={`rounded-2xl px-5 py-4 border text-sm font-medium
      ${alert.type === "worsening"
        ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-300"
        : "bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-300"
      }`}>
      {alert.message}
    </div>
  );
})()}
            {/* Done */}
            {step === STEPS.DONE && (
              <>
                <p className="text-center text-green-600 dark:text-green-400 text-xs font-semibold">
                  ✅ Analysis complete — Always consult a healthcare professional.
                </p>
                <button onClick={downloadPDF}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-2">
                  📄 Download Report (PDF)
                </button>
                <button onClick={handleReset}
                  className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-xl transition border border-gray-200 dark:border-gray-700">
                  Ask Another Question
                </button>

                {/* Follow-up Chat */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
                  <p className="text-blue-600 dark:text-blue-400 text-xs uppercase tracking-widest font-semibold mb-4">
                    💬 Ask a Follow-up
                  </p>
                  <div className="flex flex-col gap-3 mb-4">
                    {followUpMessages.length === 0 && (
                      <p className="text-gray-400 text-xs">Ask anything about your analysis...</p>
                    )}
                    {followUpMessages.map((msg, i) => (
                      <div key={i} className={`rounded-xl px-4 py-3 text-sm max-w-[85%] ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white self-end ml-auto"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 self-start"
                      }`}>
                        {msg.text}
                      </div>
                    ))}
                    {followUpLoading && (
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 animate-pulse self-start">
                        Thinking...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                      placeholder="e.g. Is this safe for kids?"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleFollowUp()}
                    />
                    <button onClick={handleFollowUp} disabled={followUpLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}