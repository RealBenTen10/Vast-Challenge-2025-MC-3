import React from "react";
import { Button, Alert } from "@heroui/react";

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
  setFilterDepth: (n: number) => void;
  callApi: (endpoint: string) => void;
  statusMsg: string;
  setGraphData: (data: any) => void;
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
  callApi,
  statusMsg,
  setGraphData,
}) => {
  const handleShowGraph = () => {
    const params = new URLSearchParams();
    if (filterSender) params.append("filterSender", filterSender);
    if (filterReceiver) params.append("filterReceiver", filterReceiver);
    if (filterContent) params.append("filterContent", filterContent);
    const endpoint = `/read-db-graph?${params.toString()}`;
    callApi(endpoint);
  };

  return (
    <div className="w-[400px] flex-shrink-0 border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Neo4j Graph Actions</h3>
      <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">
        Load JSON Graph
      </Button>
      
      <div className="mt-4">
        <label className="text-sm font-medium">Filter sender by Entity ID:</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="text"
          value={filterSender}
          onChange={(e) => setFilterSender(e.target.value)}
          placeholder="e.g., Boss"
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">Filter receiver by Entity ID:</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="text"
          value={filterReceiver}
          onChange={(e) => setFilterReceiver(e.target.value)}
          placeholder="e.g., Boss"
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">Filter by Message Content:</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="text"
          value={filterContent}
          onChange={(e) => setFilterContent(e.target.value)}
          placeholder="e.g., permit approval"
        />
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

      

      <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />
    </div>
  );
};

export default FilterPanel;