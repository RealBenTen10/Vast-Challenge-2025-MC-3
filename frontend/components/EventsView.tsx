"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody, Badge } from "@heroui/react";

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
}

interface EventsViewProps {
  eventsAfterTimeFilter: Node[];
}

export default function EventsView({
  eventsAfterTimeFilter,
}: EventsViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const handleRowClick = (id: string) => {
    setSelectedEventId(id);
    console.log("Selected Event ID:", id);
  };

  return (
    <Card className="w-full max-w-7xl mt-8">
      <CardHeader>
        <h4 className="text-lg font-semibold">
          {eventsAfterTimeFilter.length} Events
        </h4>
      </CardHeader>

      <CardBody>
        {eventsAfterTimeFilter.length === 0 ? (
          <p>No events found.</p>
        ) : (
          <div className="overflow-auto max-h-96 border rounded">
            <table className="min-w-full text-sm text-left table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 w-32">Timestamp</th>
                  <th className="p-2 w-24">Subtype</th>
                  <th className="p-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {eventsAfterTimeFilter.map((event) => {
                  const detail =
                    event.findings ||
                    event.results ||
                    event.content ||
                    (event.destination !== undefined
                          ? `Destination: ${event.destination}`
                          : "") ||
                    (event.movement_type !== undefined
                          ? ` Movement_type: ${event.movement_type}`
                          : "") ||
                    event.outcome ||
                    (event.participants !== undefined
                      ? `Participants: ${event.participants}`
                      : null) ||
                    "No details available.";

                  return (
                    <tr
                      key={event.id}
                      className={`border-b hover:bg-gray-50 cursor-pointer ${
                        selectedEventId === event.id ? "bg-blue-100" : ""
                      }`}
                      onClick={() => handleRowClick(event.id)}
                    >
                      <td className="p-2">{
                    (event.timestamp !== undefined
                          ? `${event.timestamp}`
                          : "") ||
                          "Unknown"
                    }</td>
                      <td className="p-2">
                        <Badge color="blue">{event.sub_type}</Badge>
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
      </CardBody>
    </Card>
  );
}
