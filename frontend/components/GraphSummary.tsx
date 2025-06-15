import React from "react";

interface GraphSummaryProps {
  edgeCount: number;
  edgeTypeCounts: Record<string, number>;
  subtypeCounts: Record<string, number>;
}

const GraphSummary: React.FC<GraphSummaryProps> = ({ edgeCount, edgeTypeCounts, subtypeCounts }) => {
  return (
    <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
      <h4 className="text-md font-semibold mb-2">Graph Summary</h4>
      <h5 className="text-sm font-semibold mb-2">Edge Summary</h5>
      <p className="text-sm mb-2"><span className="font-medium">Total Edges:</span> {edgeCount}</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        {Object.entries(edgeTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
          <li key={type}><span className="font-medium">{type}</span>: {count}</li>
        ))}
      </ul>
      <h5 className="text-sm font-semibold mt-4 mb-2">Node Summary</h5>
      <ul className="list-disc list-inside text-sm space-y-1">
        {Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1]).map(([subtype, count]) => (
          <li key={subtype}><span className="font-medium">{subtype}</span>: {count}</li>
        ))}
      </ul>
    </div>
  );
};

export default GraphSummary;