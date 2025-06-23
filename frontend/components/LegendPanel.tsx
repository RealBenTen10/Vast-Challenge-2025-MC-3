import React from "react";

const LegendPanel: React.FC = () => {
  return (
    <div className="mt-4 flex flex-wrap gap-8">
      <div className="border rounded-lg p-4">
        <h5 className="text-md font-semibold mb-2">Node Legend</h5>
        <ul className="text-sm space-y-1">
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#1f77b4" }}></span>Entity</li>
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#2ca02c" }}></span>Event</li>
          <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#d62728" }}></span>Communication</li>
        </ul>
      </div>
      <div className="border rounded-lg p-4">
        <h5 className="text-md font-semibold mb-2">Edge Legend</h5>
        <ul className="text-sm space-y-1">
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#d62728" }}></span>Suspicious</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#d62728" }}></span>Reports</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#d62728" }}></span>Unfriendly</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Colleagues</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Operates</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Friends</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Collaborate</li>
          <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Jurisdiction</li>
        </ul>
      </div>
    </div>
  );
};

export default LegendPanel;
