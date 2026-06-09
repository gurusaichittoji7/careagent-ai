import { useState } from "react";
import ReactMarkdown from "react-markdown";

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

const STEPS = {
  INPUT: "input",
  CLARIFYING: "clarifying",
  CONTEXT: "context",
  ANALYZING: "analyzing",
  DONE: "done",
};

export default function App() {
  const [question, setQuestion] = useState("");
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [context, setContext] = useState("");
  const [agentStates, setAgentStates] = useState({});
  const [step, setStep] = useState(STEPS.INPUT);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setStep(STEPS.CLARIFYING);
    setAgentStates({});
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
    setStep(STEPS.INPUT);
    setQuestion("");
    setClarifyingQuestion("");
    setContext("");
    setAgentStates({});
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      {/* Header */}
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

        {/* Step 1: Question Input */}
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
            <button
              onClick={handleAsk}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
            >
              Continue →
            </button>
          )}
        </div>

        {/* Step 2: Clarifying Question */}
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
                  <button
                    onClick={handleAnalyze}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
                  >
                    🧠 Analyze with All Agents
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Agent Cards */}
        {AGENTS.map((agent) => {
          const state = agentStates[agent.key];
          if (!state) return null;
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
                {state.status === "thinking" && (
                  <span className="ml-auto text-xs text-gray-400 animate-pulse">
                    thinking...
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

        {/* Done */}
        {step === STEPS.DONE && (
          <>
            <div className="text-center text-green-400 text-sm font-semibold">
              ✅ All agents completed — Always consult a healthcare professional.
            </div>
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
  );
}