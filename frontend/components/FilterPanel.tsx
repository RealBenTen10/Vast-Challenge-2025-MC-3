import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button, Alert, Input } from "@heroui/react";

interface FilterPanelProps {
  selectedEventTypes: string[];
  setSelectedEventTypes: (types: string[]) => void;
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  filterContent: string;
  setFilterContent: (c: string) => void;
  filterDepth: number;
  timestampFilterStart: string | null;
  timestampFilterEnd: string | null;
  setTimestampFilterStart: (start: string | null) => void;
  setTimestampFilterEnd: (end: string | null) => void;
  setFilterDepth: (n: number) => void;
  callApi: (endpoint: string) => void;
  statusMsg: string;
  setGraphData: (data: any) => void;
  relevantEvents: Set<string>;
  setrelevantEvents: (events: Set<string>) => void;
  // CommunicationView Filter
  msvStartDate: string;
  setMsvStartDate: (v: string) => void;
  msvEndDate: string;
  setMsvEndDate: (v: string) => void;
  msvEntityFilter: string;
  setMsvEntityFilter: (v: string) => void;
  msvKeyword: string;
  setMsvKeyword: (v: string) => void;
  loadMSV: () => void;
  allEntities?: { id: string; sub_type?: string }[]; // Add allEntities prop
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedEventTypes,
  setSelectedEventTypes,
  filterSender,
  setFilterSender,
  filterReceiver,
  setFilterReceiver,
  filterContent,
  setFilterContent,
  filterDepth,
  setFilterDepth,
  timestampFilterStart,
  timestampFilterEnd,
  setTimestampFilterStart,
  setTimestampFilterEnd,
  callApi,
  statusMsg,
  setGraphData,
  relevantEvents,
  setrelevantEvents,
  msvStartDate,
  setMsvStartDate,
  msvEndDate,
  setMsvEndDate,
  msvEntityFilter,
  setMsvEntityFilter,
  msvKeyword,
  setMsvKeyword,
  loadMSV,
  allEntities = [],
  ...props
}) => {
  const [contentInput, setContentInput] = useState(filterContent);
  const [lastEditedField, setLastEditedField] = useState<"sender" | "receiver" | null>(null);


  const handleContentKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyContentFilter();
    }
  };

  const applyContentFilter = async () => {
    const trimmed = contentInput.trim();
    setFilterContent(trimmed);

    if (!trimmed) {
      setrelevantEvents(new Set());
      return;
    }

    try {
      const res = await fetch(`/api/similarity-search-events?query=${encodeURIComponent(trimmed)}&score_threshold=0.7`);
      const data = await res.json();
      if (data.success) {
        const ids = new Set<string>(data.event_ids);
        setrelevantEvents(ids);
        console.log("Similar events found:", ids);
      } else {
        console.error("Similarity search failed:", data.error);
      }
    } catch (err) {
      console.error("Similarity search failed:", err);
    }
  };

  const [entitySuggestions, setEntitySuggestions] = React.useState<string[]>([]);

  const handleEntityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilterEntityId(value);
    if (value.length > 0) {
      setEntitySuggestions(
        allEntities
          .map(e => e.id)
          .filter(id => id.toLowerCase().includes(value.toLowerCase()))
          .slice(0, 8)
      );
    } else {
      setEntitySuggestions([]);
    }
  };

  return (
    <div className="w-[329px] flex-shrink-0 border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2 text-right">Graph Actions</h3>
      <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">
        Load JSON Graph
      </Button>

      <div className="mt-4">
        <label className="text-sm font-medium">Filter sender by Entity ID:</label>
        <select
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          value={filterSender}
          onChange={(e) => setFilterSender(e.target.value)}
        >
          <option value="">-- Select Sender --</option>
          {allEntities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.id}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">Filter receiver by Entity ID:</label>
        <select
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          value={filterReceiver}
          onChange={(e) => setFilterReceiver(e.target.value)}
        >
          <option value="">-- Select Receiver --</option>
          {allEntities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.id}
            </option>
          ))}
        </select>
      </div>


      <div className="mt-4">
        <label className="text-sm font-medium">Filter by Keywords:</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="text"
          value={contentInput}
          onChange={(e) => setContentInput(e.target.value)}
          onKeyDown={handleContentKeyPress}
          placeholder="e.g., permit approval"
        />
        <div className="mt-2 flex justify-end">
          <Button
            color="primary"
            size="sm"
            onPress={applyContentFilter}
          >
            Apply Content Filter
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">Neighbor Depth (n):</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="number"
          min={0}
          max={9}
          value={filterDepth}
          onChange={(e) => setFilterDepth(Number(e.target.value))}
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">Start Timestamp (ISO):</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="datetime-local"
          value={timestampFilterStart ?? ""}
          onChange={(e) => setTimestampFilterStart(e.target.value || null)}
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">End Timestamp (ISO):</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="datetime-local"
          value={timestampFilterEnd ?? ""}
          onChange={(e) => setTimestampFilterEnd(e.target.value || null)}
        />
      </div>

      <Button
        onPress={() => {
          setTimestampFilterEnd(null);
          setTimestampFilterStart(null);
          setFilterSender("");
          setFilterReceiver("");
          setFilterContent("");
          setFilterDepth(1);
          setSelectedEventTypes([]);
          setContentInput("");
          setrelevantEvents(new Set());
        }}
        className="mt-4"
        color="danger"
      >
        Reset Filters
      </Button>
      
      
      <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />
    </div>
  );
};

export default FilterPanel;
