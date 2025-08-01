"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@heroui/react";

interface Node {
  id: string;
  timestamp: string;
  findings?: string;
  results?: string;
  content?: string;
  destination?: string;
  movement_type?: string;
  outcome?: string;
  participants?: number;
  sub_type: string;
  sources?: string[];  // updated to list
  targets?: string[];  // updated to list
  monitoring_type?: string;
  assessment_type?: string;
  enforcement_type?: string;
  activity_type?: string;
  reference?: string;
}

interface EventsViewProps {
  eventsAfterTimeFilter: Node[];
  setSelectedEventId: (id: string) => void;
  selectedEventId: string | null;
  setFilterModeMessages: (mode: "all" | "filtered" | "direct" | "directed" | "evidence" | "similarity") => void;

}

export default function EventsView({
  eventsAfterTimeFilter,
  setSelectedEventId,
  selectedEventId,
  setFilterModeMessages,
}: EventsViewProps) {
  
  const [eventEntitiesMap, setEventEntitiesMap] = useState<Record<string, { source?: string; target?: string }>>({});

  useEffect(() => {
  const fetchEventEntities = async () => {
    if (eventsAfterTimeFilter.length === 0) return;

    const allResults: Record<string, { source?: string; target?: string }> = {};

    const eventIds = eventsAfterTimeFilter.map(e => e.id);

    // Split into batches
    for (let i = 0; i < eventIds.length; i += 300) {
      const batch = eventIds.slice(i, i + 300);
      try {
        const res = await fetch("/api/event-entities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });

        const data = await res.json();
        if (data.success) {
          Object.assign(allResults, data.data);
        } else {
          console.error(`Batch ${i / 300 + 1} failed:`, data.error);
        }
      } catch (err) {
        console.error(`Error fetching batch ${i / 300 + 1}:`, err);
      }
    }
    console.log("All results fetched:", allResults);
    setEventEntitiesMap(allResults);
  };
  console.log(eventsAfterTimeFilter);
  fetchEventEntities();
}, [eventsAfterTimeFilter]);



  const handleRowClick = (id: string) => {
    setSelectedEventId(id);
    console.log("Selected Event ID:", id);
    setFilterModeMessages("evidence");
  };

  return (
    <div className="w-full mt-8 h-full flex flex-col">
      <h4 className="text-lg font-semibold mb-2">
        {eventsAfterTimeFilter.length} Events
      </h4>
      {eventsAfterTimeFilter.length === 0 ? (
        <p>No events found.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto border rounded">
          <table className="min-w-full text-sm text-left table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 w-32">Timestamp</th>
                <th className="p-2 w-24">Subtype</th>
                <th className="p-2 w-24">Sources</th>
                <th className="p-2 w-24">Targets</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {eventsAfterTimeFilter.map((event) => {
                console.log("EventView: ", event)
                const entities = eventEntitiesMap[event.id] || {};

                // Use entity data from the eventEntitiesMap first, fallback to static event object
                const sources: string[] = entities.sources ?? event.sources ?? [];
                const targets: string[] = entities.targets ?? event.targets ?? [];
                console.log("Sources", sources)

                // Format for display 
                const sourceDisplay = sources.length > 0 ? sources.join(", ") : "–";
                const targetDisplay = targets.length > 0 ? targets.join(", ") : "–";

                // Accumulate all possible event details
                const detailParts: string[] = [];

                if (event.findings) detailParts.push(event.findings);
                if (event.results) detailParts.push(event.results);
                if (event.content) detailParts.push(event.content);
                if (event.destination !== undefined) detailParts.push(`Destination: ${event.destination}`);
                if (event.outcome) detailParts.push(event.outcome);
                if (event.participants !== undefined) detailParts.push(`Participants: ${event.participants}`);
                if (event.movement_type !== undefined) detailParts.push(`${event.movement_type}`);
                if (event.monitoring_type !== undefined) detailParts.push(`${event.monitoring_type}`);
                if (event.assessment_type !== undefined) detailParts.push(`${event.assessment_type}`);
                if (event.enforcement_type !== undefined) detailParts.push(`${event.enforcement_type}`);
                if (event.activity_type !== undefined) detailParts.push(`${event.activity_type}`);
                if (event.reference !== undefined) detailParts.push(`Reference: ${event.reference}`);

                const detail = detailParts.length > 0 ? detailParts.join(" | ") : "No details available.";



                return (
                  <tr
                    key={event.id}
                    className={`border-b hover:bg-gray-50 cursor-pointer ${
                      selectedEventId === event.id ? "bg-blue-100" : ""
                    }`}
                    onClick={() => handleRowClick(event.id)}
                  >
                    <td className="p-2">{event.timestamp || "Unknown"}</td>
                    <td className="p-2">
                      {event.sub_type}
                    </td>
                    <td className="p-2">
                      {sourceDisplay}
                    </td>
                    <td className="p-2">
                      {targetDisplay}
                    </td>
                    <td className="p-2 whitespace-pre-wrap break-words">
                      {detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
