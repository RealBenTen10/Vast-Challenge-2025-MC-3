// components/QuestionInput.tsx
"use client";
import { useState } from "react";

export default function QuestionInput() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const ask = async () => {
    if (!question.trim()) return;
    const res = await fetch(`/api/ask?question=${encodeURIComponent(question)}`);
    const data = await res.json();
    setResponse(data.answer || data.error);
  };

  return (
    <div className="w-full max-w-3xl mt-6 border p-4 rounded-lg">
      <label className="block font-semibold mb-1">Ask a question:</label>
      <input
        type="text"
        className="w-full border px-3 py-2 rounded text-sm"
        placeholder="e.g., Who did Boss communicate with on Oct 14?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button onClick={ask} className="mt-2 px-4 py-1 bg-blue-600 text-white rounded">Ask</button>
      {response && (
        <div className="mt-4 text-sm text-gray-700">
          <strong>Answer:</strong> {response}
        </div>
      )}
    </div>
  );
}
