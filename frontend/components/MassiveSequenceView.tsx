import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button, Input } from "@heroui/react";

interface MSVItem {
  event_id: string;
  timestamp: string;
  source: string;
  target: string;
  content: string;
  sub_type: string;
}

export default function MassiveSequenceView() {
  const [msvData, setMsvData] = useState<MSVItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");

  const loadMSV = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (entityFilter) params.append("entity_ids", entityFilter);
      if (keyword) params.append("keyword", keyword);

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
  }, []);

  return (
    <Card className="w-full max-w-7xl mt-8">
      <CardHeader>
        <h4 className="text-lg font-semibold">Massive Sequence View</h4>
      </CardHeader>
      <CardBody>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <Input label="Start Date (YYYY-MM-DD)" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date (YYYY-MM-DD)" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input label="Entity ID" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} />
          <Input label="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Button color="primary" onClick={loadMSV}>Apply Filters</Button>
        </div>

        {loading ? (
          <p>Loading sequence data...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : msvData.length === 0 ? (
          <p>No sequence data found.</p>
        ) : (
          <div className="overflow-auto max-h-96 border rounded">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Target</th>
                  <th className="p-2">Event Type</th>
                  <th className="p-2">Content</th>
                </tr>
              </thead>
              <tbody>
                {msvData.map((item) => (
                  <tr key={item.event_id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{item.timestamp}</td>
                    <td className="p-2">{item.source}</td>
                    <td className="p-2">{item.target}</td>
                    <td className="p-2">{item.sub_type}</td>
                    <td className="p-2 truncate max-w-xs">{item.content}</td>
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
