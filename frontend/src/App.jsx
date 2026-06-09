import { useState } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

const AGENTS = [
  {
    key: "classifier",
    icon: "🔍",
    label: "Symptom Classifier",
    color: "border-purple-600",
    headerColor: "text-purple-400",
    bg: "bg-purple-950",
  },
  {
    key: "risk",
    icon: "⚠️",
    label: "Risk Assessor",
    color: "border-yellow-600",
    headerColor: "text-yellow-400",
    bg: "bg-yellow-950",
  },
  {
    key: "recommendation",
    icon: "💊",
    label: "Recommendation Generator",
    color: "border-blue-600",
    headerColor: "text-blue-400",
    bg: "bg-blue-950",
  },
  {
    key: "safety",
    icon: "🛡️",
    label: "Safety Checker",
    color: "border-green-600",
    headerColor: "text-green-400",
    bg: "bg-green-950",
  },
];

const SEVERITY_STYLES = {
  Low: "bg-green-800 text-green-200",
  Moderate: "bg-yellow-800 text-yellow-200",
  High: "bg-orange-800 text-orange-200",
  Emergency: "bg-red-800 text-red-200 animate-pulse",
};

const STEPS = {
  INPUT: "input",
  CLARIFYING: "clarifying",
  CONTEXT: "context",
  ANALYZING: "analyzing",
  DONE: "done",
};

function AgentTimeline({ agentStates }) {
  const TIMELINE = [
    { key: "classifier", icon: "🔍", label: "Classify" },
    { key: "risk", icon: "⚠️", label: "Risk" },
    { key: "recommendation", icon: "💊", label: "Recommend" },
    { key: "safety", icon: "🛡️", label: "Safety" },
  ];

  return (
    <div className="flex items-center justify-between w-full bg-gray-900 border border-gray-700 rounded-xl px-6 py-4">
      {TIMELINE.map((agent, i) => {
        const state = agentStates[agent.key];
        const isThinking = state?.status === "thinking" && !state?.result;
        const isDone = !!state?.result;
        return (
          <div key={agent.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-500
                ${isDone ? "border-green-500 bg-green-950" :
                  isThinking ? "border-blue-400 bg-blue-950 animate-pulse" :
                  "border-gray-700 bg-gray-800"}`}>
                {agent.icon}
              </div>
              <span className={`text-xs ${isDone ? "text-green-400" : isThinking ? "text-blue-400 animate-pulse" : "text-gray-600"}`}>
                {agent.label}
              </span>
            </div>
            {i < TIMELINE.length - 1 && (
              <div className={`h-0.5 w-12 mx-1 mb-4 transition-all duration-500 ${isDone ? "bg-green-500" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [context, setContext] = useState("");
  const [agentStates, setAgentStates] = useState({});
  const [severity, setSeverity] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [step, setStep] = useState(STEPS.INPUT);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState([]);

  const startListening = (setter) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported. Try Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (e) => setter(e.results[0][0].transcript);
    recognition.onerror = () => setListening(false);
    recognition.start();
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setStep(STEPS.CLARIFYING);
    setAgentStates({});
    setSeverity(null);
    setConfidence(null);
    setClarifyingQuestion("");
    setContext("");

    try {
      const res = await fetch("http://localhost:8000/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
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

    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            } else if (data.agent === "risk" && data.severity) {
              setSeverity(data.severity);
              setAgentStates((prev) => ({
                ...prev,
                risk: {
                  status: data.status || "done",
                  result: data.result || prev.risk?.result,
                },
              }));
            } else {
              setAgentStates((prev) => ({
                ...prev,
                [data.agent]: {
                  status: data.status || "done",
                  result: data.result || prev[data.agent]?.result,
                },
              }));
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
    setHistory((prev) => [
      {
        question,
        context,
        severity,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  }
  setStep(STEPS.INPUT);
  setQuestion("");
  setClarifyingQuestion("");
  setContext("");
  setAgentStates({});
  setSeverity(null);
  setConfidence(null);
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
    doc.setFillColor(30, 30, 60);
    doc.rect(margin - 2, y - 5, maxWidth + 4, 9, "F");
    doc.setTextColor(150, 180, 255);
    addText(title, 12, true);
    doc.setTextColor(30, 30, 30);
    const clean = content?.replace(/\*\*/g, "").replace(/#+/g, "").trim();
    addText(clean, 10);
    y += 4;
  };

  // Header
  doc.setFillColor(10, 20, 50);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(100, 160, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("CareAgent", margin, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("AI Health Reasoning Report", margin, 24);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);
  y = 45;

  // Severity
  doc.setTextColor(30, 30, 30);
  if (severity) {
    addText(`Severity Level: ${severity}`, 13, true);
  }

  // Question + Context
  addText(`Question: ${question}`, 11, true);
  if (context) addText(`Additional Context: ${context}`, 10);
  y += 4;

  // Agent Results
  addSection("SYMPTOM CLASSIFICATION", agentStates.classifier?.result);
  addSection("RISK ASSESSMENT", agentStates.risk?.result);
  addSection("RECOMMENDATIONS", agentStates.recommendation?.result);
  addSection("SAFETY NOTES", agentStates.safety?.result);

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("CareAgent is not a substitute for professional medical advice. Always consult a doctor.", margin, 290);
  }

  doc.save(`careagent-report-${Date.now()}.pdf`);
};

  return (
  <div className="min-h-screen bg-gray-950 text-white flex">

    {/* Sidebar */}
    <div className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 p-4 gap-3 min-h-screen">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">🕐 Session History</p>
      {history.length === 0 && (
        <p className="text-gray-600 text-xs">No history yet. Ask a question to get started.</p>
      )}
      {history.map((item, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <p className="text-white text-xs font-semibold truncate">{item.question}</p>
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
              ${item.severity === "Emergency" ? "bg-red-800 text-red-200" :
                item.severity === "High" ? "bg-orange-800 text-orange-200" :
                item.severity === "Moderate" ? "bg-yellow-800 text-yellow-200" :
                "bg-green-800 text-green-200"}`}>
              {item.severity || "Unknown"}
            </span>
            <span className="text-gray-500 text-xs">{item.timestamp}</span>
          </div>
        </div>
      ))}
    </div>

    {/* Main Content */}
    <div className="flex-1 flex flex-col items-center px-4 py-12">
      <h1 className="text-4xl font-bold text-blue-400 mb-1">🩺 CareAgent</h1>
      <p className="text-gray-400 mb-2 text-center text-sm">
        Multi-agent AI health reasoning — powered by 4 specialized agents
      </p>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {AGENTS.map((a) => (
          <span key={a.key} className="text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-400">
            {a.icon} {a.label}
          </span>
        ))}
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Agent Timeline */}
        {(step === STEPS.ANALYZING || step === STEPS.DONE) && (
          <AgentTimeline agentStates={agentStates} />
        )}

        {/* Severity Banner */}
        {severity && severity !== "Emergency" && (
          <div className={`rounded-xl px-5 py-3 flex items-center justify-between ${SEVERITY_STYLES[severity]}`}>
            <span className="font-bold text-sm uppercase tracking-widest">
              {severity === "High" ? "🔴" : severity === "Moderate" ? "🟡" : "🟢"} Severity: {severity}
            </span>
          </div>
        )}

        {/* Emergency Alert */}
        {severity === "Emergency" && (
          <div className="rounded-xl border-2 border-red-500 bg-red-950 px-6 py-5 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🚨</span>
              <span className="text-red-300 font-black text-lg uppercase tracking-widest">
                Emergency Detected
              </span>
            </div>
            <p className="text-red-200 text-sm mb-4">
              Your symptoms may require immediate medical attention. Do not wait.
            </p>
            <a
              href="tel:911"
              className="block w-full text-center bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition text-lg">
              📞 Call 911 Now
            </a>
          </div>
        )}

        {/* Question Input */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
            💬 Your Question
          </p>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={3}
            placeholder="e.g. I have a severe headache and feel nauseous"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={step !== STEPS.INPUT}
          />
          {step === STEPS.INPUT && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => startListening(setQuestion)}
                className={`py-3 px-5 rounded-xl transition font-semibold ${listening ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"} text-white`}
                title="Speak your question"
              >
                🎤
              </button>
              <button
                onClick={handleAsk}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
              >
                Continue →
              </button>
            </div>
          )}
        </div>

        {/* Clarifying Question */}
        {(step === STEPS.CLARIFYING || step === STEPS.CONTEXT || step === STEPS.ANALYZING || step === STEPS.DONE) && (
          <div className="bg-gray-900 border border-blue-800 rounded-xl p-5">
            <p className="text-blue-400 text-xs uppercase tracking-widest mb-2">
              🤔 Follow-up Question
            </p>
            {step === STEPS.CLARIFYING ? (
              <p className="text-gray-400 animate-pulse">Generating question...</p>
            ) : (
              <>
                <p className="text-white mb-3">{clarifyingQuestion}</p>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  rows={2}
                  placeholder="Type your answer here..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  disabled={step !== STEPS.CONTEXT}
                />
                {step === STEPS.CONTEXT && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => startListening(setContext)}
                      className={`py-3 px-5 rounded-xl transition font-semibold ${listening ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"} text-white`}
                      title="Speak your answer"
                    >
                      🎤
                    </button>
                    <button
                      onClick={handleAnalyze}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
                    >
                      🧠 Analyze with All Agents
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Agent Cards */}
        {AGENTS.map((agent) => {
          const state = agentStates[agent.key];
          if (!state) return null;
          const score = confidence?.[agent.key];
          return (
            <div
              key={agent.key}
              className={`${agent.bg} border ${agent.color} rounded-xl p-5 transition-all`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{agent.icon}</span>
                <span className={`font-bold text-sm uppercase tracking-widest ${agent.headerColor}`}>
                  {agent.label}
                </span>
                {state.status === "thinking" && !state.result && (
                  <span className="ml-auto text-xs text-gray-400 animate-pulse">
                    thinking...
                  </span>
                )}
                {score && (
                  <span className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-300">
                    {score}% confidence
                  </span>
                )}
              </div>
              {state.result && (
                <div className="text-gray-200 text-sm leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown>{state.result}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {step === STEPS.DONE && (
  <>
    <div className="text-center text-green-400 text-sm font-semibold">
      ✅ All agents completed — Always consult a healthcare professional.
    </div>
    <button
      onClick={downloadPDF}
      className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
    >
      📄 Download Session Report (PDF)
    </button>
    <button
      onClick={handleReset}
      className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition"
    >
      Ask Another Question
    </button>
  </>
)}

      </div>
    </div>
  </div>
);
}