import React from "react";
import { Card, CardHeader, CardBody } from "@heroui/react";

interface MSVItem {
  event_id: string;
  timestamp: string;
  source: string;
  target: string;
  content: string;
  sub_type: string;
}

interface CommunicationViewPropsyy {
  className?: string;
  onMessageClick?: (id: string) => void;
  msvData: MSVItem[];
  msvLoading: boolean;
  msvError: string | null;
}

export default function CommunicationView({ className, onMessageClick, msvData, msvLoading, msvError }: CommunicationViewProps) {
  return (
    <Card className={`w-full max-w-7xl mt-8 ${className || ""}`}>
      <CardHeader>
        <h4 className="text-lg font-semibold">Messages</h4>
      </CardHeader>
      <CardBody>
        {msvLoading ? (
          <p>Loading sequence data...</p>
        ) : msvError ? (
          <p className="text-red-500">{msvError}</p>
        ) : msvData.length === 0 ? (
          <p>No sequence data found.</p>
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
                {msvData.map((item) => (
                  <tr
                    key={item.event_id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => onMessageClick?.(String(item.event_id))}
                  >
                    <td className="p-2">{item.timestamp}</td>
                    <td className="p-2">{item.source}</td>
                    <td className="p-2">{item.target}</td>
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
