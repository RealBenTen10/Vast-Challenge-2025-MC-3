import React from "react";

const LegendPanel: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-8" style={{ marginTop: 0 }}>
      <div className="border rounded-lg p-4">
        <h5 className="text-md font-semibold mb-2" style={{ marginTop: 0 }}>Node Legend</h5>
        <ul className="text-sm space-y-1">
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#1f77b4" }}></span>Entity</li>
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#2ca02c" }}></span>Event</li>
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#d62728" }}></span>Relationship</li>
        </ul>
      </div>
      <div className="border rounded-lg p-4">
        <h5 className="text-md font-semibold mb-2" style={{ marginTop: 0 }}>Edge Legend</h5>
        <ul className="text-sm space-y-1">
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Communication</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#800080" }}></span>Evidence For</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "brown" }}></span>Relationship</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#999" }}></span>Other</li>
        </ul>
      </div>
    </div>
  );
};

export default LegendPanel;
