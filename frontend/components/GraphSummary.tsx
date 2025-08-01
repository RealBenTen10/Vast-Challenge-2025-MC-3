import React from "react";

interface GraphSummaryProps {
  edgeCount: number;
  edgeTypeCounts: Record<string, number>;
  subtypeCounts: Record<string, number>;
  entities?: { id: string; sub_type?: string }[];
}

const GraphSummary: React.FC<GraphSummaryProps> = ({ edgeCount, edgeTypeCounts, subtypeCounts, entities }) => {
  const specialEdgeTypes = ["sent", "received", "RELATED_TO", "evidence_for", "Event edges"];
  const keywordEdgeTypes = Object.entries(edgeTypeCounts)
    .filter(([type]) => !specialEdgeTypes.includes(type));
  const onlySpecialEdges = Object.entries(edgeTypeCounts)
    .filter(([type]) => specialEdgeTypes.includes(type));

  return (
    <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 flex flex-col flex-1 overflow-y-auto">
      <h4 className="text-md font-semibold mb-2">Graph Summary</h4>
      <h5 className="text-sm font-semibold mb-2">Edge Summary</h5>
      <p className="text-sm mb-2"><span className="font-medium">Total Edges:</span> {edgeCount}</p>
      <p className="text-sm mb-2"><span className="font-medium">Communication and Relationship edges:</span> </p>
      
      <ul className="list-disc list-inside text-sm space-y-1">
        {keywordEdgeTypes.sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const label = type === "Event" ? "Communication" : type;
          return (
            <li key={label}>
              <span className="font-medium">{label}</span>: {count}
            </li>
          );
        })}
      </ul>

      <div className="my-2" />
      <p className="text-sm mb-2"><span className="font-medium">Additional edge Types:</span> </p>
      <ul className="list-disc list-inside text-sm space-y-1">
        {onlySpecialEdges.map(([type, count]) => (
          <li key={type}><span className="font-medium">{type}</span>: {count}</li>
        ))}
      </ul>
      <div className="border-t border-gray-300 my-4" />
      <h5 className="text-sm font-semibold mb-2">Node Summary</h5>
      <ul className="list-disc list-inside text-sm space-y-1">
        {Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1]).map(([subtype, count]) => (
          <li key={subtype}><span className="font-medium">{subtype}</span>: {count}</li>
        ))}
      </ul>
      <div className="border-t border-gray-300 my-4" />
      <h5 className="text-sm font-semibold mb-2">List of all entities</h5>
      <ul className="list-disc list-inside text-sm space-y-1">
        {entities && entities.length > 0 ? (
          entities.map((entity) => (
            <li key={entity.id}>
              <span className="font-medium">{entity.id}</span>
              {entity.sub_type ? <span className="text-xs text-gray-500"> ({entity.sub_type})</span> : null}
            </li>
          ))
        ) : (
          <li className="text-xs text-gray-400">No entities found.</li>
        )}
      </ul>
    </div>
  );
};

export default GraphSummary;