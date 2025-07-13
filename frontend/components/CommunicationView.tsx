"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Badge } from "@heroui/react";

interface MSVItem {
  event_id: string;
  label: string;
  timestamp?: string;
  source?: string;
  target?: string;
  content: string;
  sub_type: string;
  destination?: string;
  movement_type?: string;

}

interface EntityInfo {
  id: string;
  label: string;
  sub_type?: string;
  name?: string;
  type: string;
}

interface EventMetadata {
  id: string;
  sub_type: string;
  label?: string;
  timestamp?: string;
  content?: string;
  movement_type?: string;
  destination?: string;
}

interface EventInfoResponse {
  event: EventMetadata;
  sources: EntityInfo[];
  targets: EntityInfo[];
}

interface EventInfo {
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
  const [previousQueryInput, setPreviousQueryInput] = useState<string>(""); 
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.7)
  const [prevSimilarityThreshold, setPrevSimilarityThreshold] = useState<number>(0.7)
  const [topK, setTopK] = useState<number>(50);
  const [prevTopK, setPrevTopK] = useState<number>(50);
  const [byTime, setByTime] = useState(false);
  const [prevByTime, setPrevByTime] = useState(false); 
  const [infoText, setInfoText] = useState<EventInfo[]>([]);
  const [eventInfo, setEventInfo] = useState<EventInfoResponse | null>(null);


  useEffect(() => {
  const fetchEvidence = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/evidence-for-event?event_id=${selectedEventId}`);
      const data = await res.json();
      if (data.success) {
        setEvidenceResults(data.data);           // Communication evidence
        setEventInfo(data.info);                 // Event metadata + source/target entities
      } else {
        setError("Failed to fetch evidence messages.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setFilterModeMessages("evidence");
    }
  };
  fetchEvidence();
}, [selectedEventId]);



  const handleSimilaritySearch = async (query?: string) => {
    const searchQuery = query ?? similarityQuery;
    //if (!searchQuery) return;
    try {
      setLoading(true);
      // set input box to "" if message was clicked instead of user input
      if (query) setSimilarityQuery(query);
      
      const res = await fetch(`/api/similarity-search?query=${encodeURIComponent(searchQuery)}&top_k=${topK}&order_by_time=${byTime}`);
      const data = await res.json();
      if (data.success) {
        setSimilarityResults(data.data);
        console.log(data.data)
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
    <div className="w-full mt-8 h-full flex flex-col">
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
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={similarityQuery}
          onChange={(e) => setSimilarityQuery(e.target.value)}
          placeholder="Enter message text (e.g., 'dolphins at Nemo Reef')"
          className="border px-3 py-1 rounded w-full"
        />
        <button
          onClick={() => {
            setQueryInput(similarityQuery);
            setPrevTopK(topK)
            setPrevByTime(byTime)
            handleSimilaritySearch();
          }}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Search
        </button>
      </div>

      

      <div className="flex items-center gap-4">
        <label htmlFor="top-k" className="text-sm font-medium whitespace-nowrap">
          Top-K Results:
        </label>
        <input
          id="top-k"
          type="number"
          min={1}
          max={500}
          step={1}
          value={topK}
          onChange={(e) => setTopK(Math.max(1, Math.min(500, Number(e.target.value))))}
          className="border px-3 py-1 rounded w-24"
        />
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="by-time" className="text-sm font-medium whitespace-nowrap">
          Order by Time:
        </label>
        <input
          id="by-time"
          type="checkbox"
          checked={byTime}
          onChange={(e) => setByTime(e.target.checked)}
          className="w-5 h-5"
        />
      </div>

          {queryInput !== "" && (
            <span className="text-sm text-gray-600">
              Displaying top {prevTopK} similar messages with threshold {prevSimilarityThreshold.toFixed(3)} ordered by{" "}
              <strong>{prevByTime ? "Timestamp" : "Similarity Score"}</strong> for: <strong>{queryInput}</strong>
            </span>
          )}
        </div>
      )}

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
      {filterModeMessages === "evidence" && (
        <div className="mt-2 flex flex-col gap-1 text-sm ml-4">

          {eventInfo?.event && (
            <div className="mt-1">
              Evidence for <span className="font-semibold">{eventInfo.event.sub_type}</span>
              {eventInfo.sources.length === 1 && eventInfo.targets.length === 1 ? (
                <>
                  {" "}
                  of <span className="font-semibold">{eventInfo.targets[0].id}</span> by{" "}
                  <span className="font-semibold">{eventInfo.sources[0].id}</span>
                </>
              ) : (
                <>
                  {" "}between{" "}
                  {[...eventInfo.sources.map(e => e.id), ...eventInfo.targets.map(e => e.id)]
                    .filter(Boolean)
                    .map((id, idx, arr) => (
                      <React.Fragment key={id}>
                        <span className="font-semibold">{id}</span>
                        {idx < arr.length - 1 && <span> and </span>}
                      </React.Fragment>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}



      <div className="flex-1 min-h-0 mt-4 overflow-auto">
        {loading ? (
          <p>Loading Message data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filteredData.length === 0 ? (
          <p>No communication records found... Maybe you forgot to set an Entity, Event or Text?</p>
        ) : (
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
                    {item.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
