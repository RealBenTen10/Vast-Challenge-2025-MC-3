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

interface CommunicationViewProps {
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  filterContent: string;
  timestampFilterStart: string;
  timestampFilterEnd: string;
  visibleEntities: { id: string; sub_type?: string }[];
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
}: CommunicationViewProps) {
  const [msvData, setMsvData] = useState<MSVItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMSV = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (timestampFilterStart) params.append("start_date", timestampFilterStart);
      if (timestampFilterEnd) params.append("end_date", timestampFilterEnd);
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
  }, [filterSender, filterReceiver, filterContent, timestampFilterEnd, timestampFilterStart]);

  return (
    <Card className="w-full max-w-7xl mt-8">
      <CardHeader>
        <h4 className="text-lg font-semibold">{msvData.length} Messages</h4>
        <div className="mt-1 flex flex-wrap gap-1 text-sm">
          <span className="ml-2"> for following filter setting - </span>
          {filterSender && <Badge color="blue"> Sender: {filterSender}</Badge>}
          {filterReceiver && <Badge color="green"> Receiver: {filterReceiver}</Badge>}
          {filterContent && <Badge color="purple"> Keyword: {filterContent}</Badge>}
          {timestampFilterStart && timestampFilterEnd && (
            <Badge color="gray">
              {new Date(timestampFilterStart).toLocaleString()} – {new Date(timestampFilterEnd).toLocaleString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p>Loading sequence data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : msvData.length === 0 ? (
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
                {msvData.map((item) => (
                  <tr key={item.event_id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{item.timestamp}</td>
                    <td className="p-2 text-blue-600 hover:underline cursor-pointer" onClick={() => setFilterSender(item.source)}>
                      {item.source}
                    </td>
                    <td className="p-2 text-green-600 hover:underline cursor-pointer" onClick={() => setFilterReceiver(item.target)}>
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
