import React from "react";

interface SelectedInfoPanelProps {
  selectedInfo: any;
}

const SelectedInfoPanel: React.FC<SelectedInfoPanelProps> = ({ selectedInfo }) => {
  return (
    <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
      <h4 className="text-md font-semibold mb-2">Selected Info</h4>
      {selectedInfo ? (
        <div className="text-sm space-y-1">
          <h5 className="text-lg font-semibold">{selectedInfo.data.id}</h5>
          {Object.entries(selectedInfo.data).map(([key, value]) => {
            if (["x", "y", "vx", "vy", "fx", "fy", "index"].includes(key)) return null;
            return (
              <p key={key}><span className="font-medium">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : value?.toString()}</p>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 italic">Click a node or edge to view details</p>
      )}
    </div>
  );
};

export default SelectedInfoPanel;