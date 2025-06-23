"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Badge, Button } from "@heroui/react";

interface MSVItem {
  event_id: string;
  timestamp: string;
  source: string;
  target: string;
  content: string;
  sub_type: string;
}

interface Node {
  id: string;
  timestamp: string;
  content: string;
  sub_type: string;
}

interface CommunicationViewProps {
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  filterContent: string;
  timestampFilterStart: string;
  timestampFilterEnd: string;
  visibleEntities: { id: string; sub_type?: string }[];
  communicationEventsWithTimeFilter: Node[];
  filterModeMessages: "all" | "filtered" | "direct" | "directed";
  setFilterModeMessages: (mode: "all" | "filtered" | "direct" | "directed") => void;
}

export default function CommunicationView({
  filterSender,
  setFilterSender,
  filterReceiver,
  setFilterReceiver,
  filterContent,
  timestampFilterStart,
  timestampFilterEnd,
  visibleEntities,
  communicationEventsWithTimeFilter,
  filterModeMessages,
  setFilterModeMessages,
}: CommunicationViewProps) {
  const [msvData, setMsvData] = useState<MSVItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMSV = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventIds = communicationEventsWithTimeFilter.map((e) => e.id);
      if (eventIds.length === 0) {
        setMsvData([]);
        return;
      }

      const BATCH_SIZE = 300;
      const batches = [];

      for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
        batches.push(eventIds.slice(i, i + BATCH_SIZE));
      }

      const allResults: MSVItem[] = [];

      for (const batch of batches) {
        const params = new URLSearchParams();
        batch.forEach((id) => params.append("event_ids", id));

        const res = await fetch(`/api/massive-sequence-view?${params.toString()}`);
        const text = await res.text();
        if (!text) throw new Error("Empty response from server");

        const data = JSON.parse(text);
        if (data.success) {
          allResults.push(...data.data);
        } else {
          throw new Error(data.error || "Failed to load data");
        }
      }

      setMsvData(allResults);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMSV();
  }, [communicationEventsWithTimeFilter]);

  const filteredData = msvData.filter((item) => {
    if (filterModeMessages === "all") return true;
    if (filterModeMessages === "filtered") {
      return (
        (filterSender && item.source === filterSender) ||
        (filterReceiver && item.target === filterReceiver)
      );
    }
    if (filterModeMessages === "direct") {
      return (
        (filterSender &&
        filterReceiver &&
        item.source === filterSender &&
        item.target === filterReceiver) ||
        (filterSender &&
        filterReceiver &&
        item.source === filterReceiver &&
        item.target === filterSender)
      );
    }
    if (filterModeMessages === "directed") {
      return (
        (filterSender &&
        filterReceiver &&
        item.source === filterSender &&
        item.target === filterReceiver)
      );
    }
    return true;
  });

  return (
    <Card className="w-full max-w-7xl mt-8">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-lg font-semibold">{filteredData.length} Messages</h4>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 text-sm border rounded ${
                filterModeMessages === "all" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
              onClick={() => setFilterModeMessages("all")}
            >
              All filtered Messages
            </button>
            <button
              className={`px-3 py-1 text-sm border rounded ${
                filterModeMessages === "filtered" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
              onClick={() => setFilterModeMessages("filtered")}
            >
              Sender or Receiver
            </button>
            <button
              className={`px-3 py-1 text-sm border rounded ${
                filterModeMessages === "direct" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
              onClick={() => setFilterModeMessages("direct")}
            >
              Sender and Receiver
            </button>
            <button
              className={`px-3 py-1 text-sm border rounded ${
                filterModeMessages === "directed" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
              onClick={() => setFilterModeMessages("directed")}
            >
              Sender to Receiver
            </button>
          </div>
        </div>

        
      </CardHeader>
      <div className="mt-2 flex flex-wrap gap-1 text-sm">
          <span className="ml-4"> Following Filters are active: </span>
          {filterSender && <Badge color="blue"> - Sender: {filterSender}</Badge>}
          {filterReceiver && <Badge color="green"> - Receiver: {filterReceiver}</Badge>}
          {filterContent && <Badge color="purple"> - Keyword: {filterContent}</Badge>}
          {timestampFilterStart && timestampFilterEnd && (
            <Badge color="gray">
              - {new Date(timestampFilterStart).toLocaleString()} –{" "}
              {new Date(timestampFilterEnd).toLocaleString()}
            </Badge>
          )}
        </div>
      <CardBody>
        {loading ? (
          <p>Loading sequence data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filteredData.length === 0 ? (
          <p>No communication records found.</p>
        ) : (
          <div className="overflow-auto max-h-96 border rounded">
            <table className="min-w-full text-sm text-left table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 w-32">Timestamp</th>
                  <th className="p-2 w-24">Source</th>
                  <th className="p-2 w-24">Target</th>
                  <th className="p-2">Content</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.event_id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{item.timestamp}</td>
                    <td
                      className="p-2 text-blue-600 hover:underline cursor-pointer"
                      onClick={() => setFilterSender(item.source)}
                    >
                      {item.source}
                    </td>
                    <td
                      className="p-2 text-green-600 hover:underline cursor-pointer"
                      onClick={() => setFilterReceiver(item.target)}
                    >
                      {item.target}
                    </td>
                    <td className="p-2 whitespace-pre-wrap break-words">{item.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
