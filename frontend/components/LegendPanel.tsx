import React, { useState } from "react";

const LegendPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="relative" style={{ minHeight: 40, marginTop: 0, paddingTop: 0 }}>
      {collapsed ? (
        <button
          className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold z-20 whitespace-nowrap"
          onClick={() => setCollapsed(false)}
          style={{ position: "absolute", right: 8, top: 8, minWidth: 45, whiteSpace: "nowrap" }}
        >
          Show
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-8" style={{ marginTop: 0, paddingTop: 0 }}>
            <div className="border rounded-lg p-4" style={{ marginTop: 0, paddingTop: 0 }}>
              <h5 className="text-md font-semibold mb-2" style={{ marginTop: 0 }}>Node Legend</h5>
              <ul className="text-sm space-y-1">
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#999" }}></span>Entity</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#1f77b4 " }}></span>Monitoring</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#ff7f0e" }}></span>Assessment</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#2ca02c" }}></span>VesselMovement</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#d62728" }}></span>Enforcement</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#9467bd" }}></span>TourActivity</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#8c564b" }}></span>Collaborate</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#17becf" }}></span>TransponderPing</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#bcbd22" }}></span>HarborReport</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#e377c2" }}></span>Criticize</li>
                <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#000" }}></span>Communication</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4" style={{ marginTop: 0, paddingTop: 0 }}>
              <h5 className="text-md font-semibold mb-2" style={{ marginTop: 0 }}>Edge Legend</h5>
              <div className="mb-2">
                <div className="font-semibold text-sm mb-1">Relationship Edges</div>
                <ul className="text-sm space-y-1">
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#d62728" }}></span>Negative</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Social</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#1f77b4" }}></span>Institutional</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#ff7f0e" }}></span>Operational</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-sm mb-1">Event Edges</div>
                <ul className="text-sm space-y-1">
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#bcbd22" }}></span>Monitoring</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#ff7f0e" }}></span>Assessment</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>VesselMovement</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#d62728" }}></span>Enforcement</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#9467bd" }}></span>TourActivity</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#8c564b" }}></span>Collaborate</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#17becf" }}></span>TransponderPing</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#17becf" }}></span>HarborReport</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#e377c2" }}></span>Criticize</li>
                  <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#999999" }}></span>Other</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold z-20 whitespace-nowrap"
            onClick={() => setCollapsed(true)}
            style={{ position: "absolute", right: 8, bottom: 8, minWidth: 45, whiteSpace: "nowrap" }}
          >
            Hide
          </button>
        </>
      )}
    </div>
  );
};

export default LegendPanel;
