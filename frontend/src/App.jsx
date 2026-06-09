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

export default function App() {
  const [question, setQuestion] = useState("");
  const [agentStates, setAgentStates] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const ask = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setDone(false);
    setAgentStates({});

    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
              setDone(true);
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
      alert("Something went wrong. Is the backend running?");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      {/* Header */}
      <h1 className="text-4xl font-bold text-blue-400 mb-1">🩺 CareAgent</h1>
      <p className="text-gray-400 mb-2 text-center text-sm">
        Multi-agent AI health reasoning — powered by 4 specialized agents
      </p>
      <div className="flex gap-2 mb-8">
        {AGENTS.map((a) => (
          <span key={a.key} className="text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-400">
            {a.icon} {a.label}
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="w-full max-w-2xl">
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          rows={3}
          placeholder="e.g. I have a severe headache and feel nauseous"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          onClick={ask}
          disabled={loading}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold py-3 rounded-xl transition"
        >
          {loading ? "⏳ Agents thinking..." : "Ask CareAgent"}
        </button>
      </div>

      {/* Agent Cards */}
      {Object.keys(agentStates).length > 0 && (
        <div className="w-full max-w-2xl mt-8 flex flex-col gap-4">
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

          {done && (
            <div className="text-center text-green-400 text-sm font-semibold mt-2">
              ✅ All agents completed — Always consult a healthcare professional for medical advice.
            </div>
          )}
        </div>
      )}
    </div>
  );
}