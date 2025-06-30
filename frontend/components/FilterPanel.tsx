import React from "react";
import { Button, Alert, Input } from "@heroui/react";

interface FilterPanelProps {
  selectedEventTypes: string[];
  setSelectedEventTypes: (types: string[]) => void;
  filterEntityId: string;
  setFilterEntityId: (id: string) => void;
  filterContent: string;
  setFilterContent: (c: string) => void;
  filterDepth: number;
  setFilterDepth: (n: number) => void;
  callApi: (endpoint: string) => void;
  statusMsg: string;
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
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedEventTypes,
  setSelectedEventTypes,
  filterEntityId,
  setFilterEntityId,
  filterContent,
  setFilterContent,
  filterDepth,
  setFilterDepth,
  callApi,
  statusMsg,
  msvStartDate,
  setMsvStartDate,
  msvEndDate,
  setMsvEndDate,
  msvEntityFilter,
  setMsvEntityFilter,
  msvKeyword,
  setMsvKeyword,
  loadMSV,
  ...props
}) => {
  return (
    <div className="w-[320px] flex-shrink-0 border rounded-lg p-4">
      <div className="flex justify-end">
        <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">
          Load JSON Graph
        </Button>
      </div>
      
      <div className="mt-4">
        <label className="text-sm font-medium">Filter by Entity ID:</label>
        <input
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          type="text"
          value={filterEntityId}
          onChange={(e) => setFilterEntityId(e.target.value)}
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

      <Button onPress={() => callApi("/read-db-graph")} className="mt-2" color="success">
        Show Graph
      </Button>

      <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />

      {/* CommunicationView Filter */}
      <div className="mt-6 border-t pt-4">
        <div className="font-semibold mb-2">Message Filter</div>
        <Input label="Start Date (YYYY-MM-DD)" value={msvStartDate} onChange={e => setMsvStartDate(e.target.value)} className="mb-2" />
        <Input label="End Date" value={msvEndDate} onChange={e => setMsvEndDate(e.target.value)} className="mb-2" />
        <Input label="Entity ID" value={msvEntityFilter} onChange={e => setMsvEntityFilter(e.target.value)} className="mb-2" />
        <Input label="Keyword" value={msvKeyword} onChange={e => setMsvKeyword(e.target.value)} className="mb-2" />
        <Button color="primary" onPress={loadMSV} className="mt-2">Apply Message Filter</Button>
      </div>
    </div>
  );
};

export default FilterPanel;