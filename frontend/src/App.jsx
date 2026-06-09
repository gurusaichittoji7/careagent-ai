import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await axios.post("http://localhost:8000/ask", { question });
      setAnswer(res.data.answer);
    } catch {
      setAnswer("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const parseAnswer = (text) => {
    const reasoning = text.match(/\*\*Reasoning:\*\*([\s\S]*?)(?=\*\*Answer:\*\*)/)?.[1]?.trim();
    const answer = text.match(/\*\*Answer:\*\*([\s\S]*?)(?=\*\*Important Note:\*\*)/)?.[1]?.trim();
    const note = text.match(/\*\*Important Note:\*\*([\s\S]*)/)?.[1]?.trim();
    return { reasoning, answer, note };
  };

  const { reasoning, answer: ans, note } = answer ? parseAnswer(answer) : {};

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      <h1 className="text-4xl font-bold text-blue-400 mb-2">CareAgent</h1>
      <p className="text-gray-400 mb-10 text-center">
        Ask any health question and get a step-by-step reasoned answer
      </p>

      <div className="w-full max-w-2xl">
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          rows={3}
          placeholder="e.g. What should I do for a headache?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          onClick={ask}
          disabled={loading}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 rounded-xl transition"
        >
          {loading ? "⏳ Thinking step by step..." : "Ask CareAgent"}
        </button>
      </div>

      {answer && (
        <div className="w-full max-w-2xl mt-8 flex flex-col gap-4">

          {reasoning && (
            <div className="bg-gray-800 border border-blue-800 rounded-xl p-5">
              <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-3">
                🧠 Reasoning
              </p>
              <div className="text-gray-300 leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown>{reasoning}</ReactMarkdown>
              </div>
            </div>
          )}

          {ans && (
            <div className="bg-blue-950 border border-blue-600 rounded-xl p-5">
              <p className="text-blue-300 font-bold text-sm uppercase tracking-widest mb-3">
                ✅ Answer
              </p>
              <div className="text-white leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown>{ans}</ReactMarkdown>
              </div>
            </div>
          )}

          {note && (
            <div className="bg-yellow-950 border border-yellow-600 rounded-xl p-5">
              <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-3">
                ⚠️ Important Note
              </p>
              <div className="text-yellow-100 leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown>{note}</ReactMarkdown>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}