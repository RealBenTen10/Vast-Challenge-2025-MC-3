"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Badge } from "@heroui/react";

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
  communicationEventsAfterTimeFilter: string[];
  filterModeMessages: "all" | "filtered" | "direct" | "directed" | "evidence" | "similarity";
  setFilterModeMessages: (mode: CommunicationViewProps["filterModeMessages"]) => void;
  selectedEventId: string | null;
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
  communicationEventsAfterTimeFilter,
  filterModeMessages,
  setFilterModeMessages,
  selectedEventId,
}: CommunicationViewProps) {
  const [msvData, setMsvData] = useState<MSVItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarityQuery, setSimilarityQuery] = useState<string>("");
  const [similarityResults, setSimilarityResults] = useState<MSVItem[]>([]);
  const [evidenceResults, setEvidenceResults] = useState<MSVItem[]>([]);
  const [queryInput, setQueryInput] = useState<string>(""); 

  useEffect(() => {
    const fetchEvidence = async () => {
      if (filterModeMessages !== "evidence") return;
      try {
        setLoading(true);
        const res = await fetch(`/api/evidence-for-event?event_id=${selectedEventId}`);
        const data = await res.json();
        if (data.success) {
          setEvidenceResults(data.data);
        } else {
          setError("Failed to fetch evidence messages.");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [filterModeMessages, selectedEventId]);

  const handleSimilaritySearch = async (query?: string) => {
    const searchQuery = query ?? similarityQuery;
    if (!searchQuery) return;
    try {
      setLoading(true);
      setSimilarityQuery("")
      const res = await fetch(`/api/similarity-search?query=${encodeURIComponent(searchQuery)}&top_k=50`);
      const data = await res.json();
      if (data.success) {
        setSimilarityResults(data.data);
      } else {
        setError("Failed to fetch similar messages.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setFilterModeMessages("similarity")
    }
  };

  useEffect(() => {
  const loadMSV = async () => {
    if (filterModeMessages === "evidence" || filterModeMessages === "similarity") return;

    setLoading(true);
    setError(null);
    try {
      const eventIds = [...communicationEventsAfterTimeFilter]; // Already a list of strings
      console.log("loadMSV: ", eventIds)
      if (eventIds.length === 0) {
        setMsvData([]);
        return;
      }
      eventIds.sort((a, b) => {
        const getNumericSuffix = (id: string) => parseInt(id.split("_").pop() || "0", 10);
        return getNumericSuffix(a) - getNumericSuffix(b);
      });
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
          // test
        const data = JSON.parse(text);
        if (data.success) {
          allResults.push(...data.data);
        } else {
          throw new Error(data.error || "Failed to load data");
        }
      }
      console.log(allResults)
      setMsvData(allResults);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  loadMSV();
}, [communicationEventsAfterTimeFilter, filterModeMessages]);


  const filteredData = (() => {
    if (filterModeMessages === "evidence") return evidenceResults;
    if (filterModeMessages === "similarity") return similarityResults;

    return msvData.filter((item) => {
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
          filterSender &&
          filterReceiver &&
          item.source === filterSender &&
          item.target === filterReceiver
        );
      }
      return true;
    });
  })();

  return (
    <Card className={`w-full max-w-7xl mt-8`}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-lg font-semibold">{filteredData.length} Messages</h4>
          <div className="flex gap-2 flex-wrap">
            {["all", "filtered", "direct", "directed", "evidence", "similarity"].map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-sm border rounded ${
                  filterModeMessages === mode ? "bg-blue-500 text-white" : "bg-gray-100"
                }`}
                onClick={() => setFilterModeMessages(mode as CommunicationViewProps["filterModeMessages"])}
              >
                {mode === "all" && "All"}
                {mode === "filtered" && "Sender or Receiver"}
                {mode === "direct" && "Sender and Receiver"}
                {mode === "directed" && "Sender to Receiver"}
                {mode === "evidence" && "Evidence for Events"}
                {mode === "similarity" && "Similar Message Search"}
              </button>
            ))}
          </div>
        </div>

        {filterModeMessages === "similarity" && (
        <div className="mt-4 flex gap-2 items-center">
          <input
            type="text"
            value={similarityQuery}
            onChange={(e) => setSimilarityQuery(e.target.value)}
            placeholder="Enter message text (e.g., 'dolphins at Nemo Reef')"
            className="border px-3 py-1 rounded w-full"
          />
          <button
            onClick={() => 
              {
                setQueryInput(similarityQuery);
                handleSimilaritySearch();
              }}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Search
          </button>
          <span className="ml-4">
            {queryInput !== ""
              ? `Searching for similar messages for: ${queryInput}`
              : "Set query input"}
          </span>
        </div>
      )}

      </CardHeader>

      {filterModeMessages !== "evidence" && filterModeMessages !== "similarity" && (
        <div className="mt-2 flex flex-wrap gap-1 text-sm">
          <span className="ml-4">Filters:</span>
          {filterSender && <Badge color="blue">Sender: {filterSender}</Badge>}
          {filterReceiver && <Badge color="green">Receiver: {filterReceiver}</Badge>}
          {filterContent && <Badge color="purple">Keyword: {filterContent}</Badge>}
          {timestampFilterStart && timestampFilterEnd && (
            <Badge color="gray">
              {new Date(timestampFilterStart).toLocaleString()} –{" "}
              {new Date(timestampFilterEnd).toLocaleString()}
            </Badge>
          )}
        </div>
      )}
      {filterModeMessages == "evidence" && (
        <div className="mt-2 flex flex-wrap gap-1 text-sm">
          <span className="ml-4">Filters:</span>
          {filterSender && <Badge color="blue">Found evidence for : {filterSender}</Badge>}
        </div>
      )}


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
                  <tr
                    key={item.event_id}
                    className="border-b hover:bg-gray-50 cursor-pointer"

                  >
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
                    <td 
                      className="p-2 whitespace-pre-wrap break-words"
                      onClick={() => {
                        setQueryInput(item.content);
                        handleSimilaritySearch(item.content);
                      }}
                    >

                      {item.content}</td>
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
