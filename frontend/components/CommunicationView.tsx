import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@heroui/react";

interface MSVItem {
  event_id: string;
  timestamp: string;
  source: string;
  target: string;
  content: string;
  sub_type: string;
}

interface CommunicationViewProps {
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  filterContent: string;
  selectedTimestamp: string | null;
}

export default function CommunicationView({
  filterSender,
  setFilterSender,
  filterReceiver,
  setFilterReceiver,
  filterContent,
  selectedTimestamp,
}: CommunicationViewProps) {
  const [msvData, setMsvData] = useState<MSVItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMSV = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedTimestamp) params.append("start_date", selectedTimestamp);
      if (selectedTimestamp) params.append("end_date", selectedTimestamp);
      if (filterSender) params.append("sender", filterSender);
      if (filterReceiver) params.append("receiver", filterReceiver);
      if (filterContent) params.append("keyword", filterContent);

      const res = await fetch(`/api/massive-sequence-view?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setMsvData(data.data);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMSV();
  }, [filterSender, filterReceiver, filterContent, selectedTimestamp]);

  return (
    <Card className="w-full max-w-7xl mt-8">
      <CardHeader>
        <h4 className="text-lg font-semibold">Messages</h4>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p>Loading sequence data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
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
                  <tr key={item.event_id} className="border-b hover:bg-gray-50">
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
