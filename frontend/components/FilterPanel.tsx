import React from "react";
import { Button, Alert } from "@heroui/react";

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
  loadGraph: () => void;
  statusMsg: string;
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
  loadGraph,
  statusMsg,
}) => {
  return (
    <div className="w-[400px] flex-shrink-0 border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Neo4j Graph Actions</h3>
      <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">
        Load JSON Graph
      </Button>
      <div className="mt-4">
        <label className="text-sm font-medium">Filter by Event Subtype(s):</label>
        <select
          multiple
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          value={selectedEventTypes}
          onChange={(e) => {
            const options = Array.from(e.target.selectedOptions, option => option.value);
            setSelectedEventTypes(options);
          }}
        >
          <option value="Communication">Communication</option>
          <option value="VesselMovement">Vessel Movement</option>
          <option value="Inspection">Inspection</option>
          <option value="Delivery">Delivery</option>
          <option value="Permit">Permit</option>
        </select>
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

      <Button onPress={loadGraph} className="mt-2" color="success">
        Show Graph
      </Button>

      <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />
    </div>
  );
};

export default FilterPanel;