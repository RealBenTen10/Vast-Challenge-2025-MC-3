// CommunicationMessages.tsx
import React, { useState, useEffect } from "react";

interface CommunicationMessage {
  id: string;
  content: string;
  timestamp?: string;
  sender?: string;
  receiver?: string;
}

interface Props {
  nodes: any[]; // full node list, expected from graphData
}

const CommunicationMessages: React.FC<Props> = ({ nodes }) => {
  const [filter, setFilter] = useState("");
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);

  useEffect(() => {
    const comms = nodes
      .filter((n) => n.type === "Event" && n.sub_type === "Communication")
      .map((n) => ({
        id: n.id,
        content: n.content,
        timestamp: n.timestamp,
      }));

    setMessages(comms);
  }, [nodes]);

  const filtered = messages.filter((m) =>
    m.content?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="w-[400px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "600px" }}>
      <h4 className="text-md font-semibold mb-2">Communication Messages</h4>

      <input
        type="text"
        placeholder="🔍 Filter messages..."
        className="w-full border px-2 py-1 rounded mb-4 text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <ul className="space-y-2 text-sm">
        {filtered.map((msg) => (
          <li key={msg.id} className="border p-2 rounded bg-gray-50">
            <p className="font-medium text-xs text-gray-600 mb-1">{msg.timestamp}</p>
            <p>{msg.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CommunicationMessages;
