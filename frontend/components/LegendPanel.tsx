import React, { useState } from "react";

interface Props {
  enabledEventTypes: Record<string, boolean>;
  setEnabledEventTypes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  enabledRelationshipTypes: Record<string, boolean>;
  setEnabledRelationshipTypes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const relationshipGroups: Record<
  string,
  { label: string; color: string; types: string[] }
> = {
  Negative: {
    label: "Negative",
    color: "#d62728", // red
    types: ["Suspicious", "Unfriendly"],
  },
  Social: {
    label: "Social",
    color: "#2ca02c", // purple
    types: ["Colleagues", "Friends", "Reports"],
  },
  Institutional: {
    label: "Institutional",
    color: "#7f7f7f", // gray
    types: ["Jurisdiction", "AccessPermission"],
  },
  Operational: {
    label: "Operational",
    color: "#17becf", // cyan
    types: ["Operates", "Coordinates"],
  },
};

const EVENT_COLOR_MAP: Record<string, string> = {
    Monitoring: "#ff7f0e ",       // orange
    Assessment: "#e377c2",        // pink
    VesselMovement: "#8c564b",    // brown
    Enforcement: "#d62728",       // red
    TourActivity: "#9467bd",      // purple
    Collaborate: "#2ca02c",       // green
    TransponderPing: "#bcbd22",   // olive
    HarborReport: "#bcbd22",      // olive
    Criticize: "#bcbd22",         // olive
    Communication: "#1f77b4"     // blue
  };

    const EventMap: Record<string, string> = {
  Monitoring: "🔍",        // radar or surveillance
  Assessment: "📋",        // clipboard representing evaluations or reports
  VesselMovement: "🚢",    // ship representing vessel motion
  Enforcement: "👮",       // police officer for law enforcement
  TourActivity: "📸",      // compass for tour-related movements or exploration
  Collaborate: "🤝",       // handshake for cooperation or collaboration
  TransponderPing: "📡",   // signal bars for electronic signal transmission
  HarborReport: "⚓",      // anchor representing harbor or docking activity
  Criticize: "🗯️",         // speech balloon for comments or criticism
  Communication: "📨"     // envelope for messages or communication
};

const getNodeColor = (type: string): string => {
  return EVENT_COLOR_MAP[type] || "#999999";
};

const LegendPanel: React.FC<Props> = ({
  enabledEventTypes,
  setEnabledEventTypes,
  enabledRelationshipTypes,
  setEnabledRelationshipTypes,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const handleEventToggle = (eventType: string) => {
    if (eventType === "Communication") return;
    setEnabledEventTypes((prev) => ({
      ...prev,
      [eventType]: !prev[eventType],
    }));
  };

  const handleRelationshipToggle = (relType: string) => {
    setEnabledRelationshipTypes((prev) => ({
      ...prev,
      [relType]: !prev[relType],
    }));
  };

  const handleGroupToggle = (groupKey: string) => {
    const group = relationshipGroups[groupKey];
    const allDisabled = group.types.every((type) => !enabledRelationshipTypes[type]);
    setEnabledRelationshipTypes((prev) => {
      const updated = { ...prev };
      for (const type of group.types) {
        updated[type] = allDisabled;
      }
      return updated;
    });
  };

  // Enable all nodes and edges
  const handleEnableAll = () => {
    // Enable all event types (nodes), except "Communication"
    const allEventTypesEnabled: Record<string, boolean> = {};
    Object.keys(EVENT_COLOR_MAP).forEach(type => {
      allEventTypesEnabled[type] = true;
    });
    setEnabledEventTypes(allEventTypesEnabled);

    // Enable all relationship types
    const allRelationshipTypesEnabled: Record<string, boolean> = {};
    Object.values(relationshipGroups).forEach(group => {
      group.types.forEach(type => {
        allRelationshipTypesEnabled[type] = true;
      });
    });
    setEnabledRelationshipTypes(allRelationshipTypesEnabled);
  };

  const handleDisableAll = () => {
    // Enable all event types (nodes), except "Communication"
    const allEventTypesEnabled: Record<string, boolean> = {};
    Object.keys(EVENT_COLOR_MAP).forEach(type => {
      allEventTypesEnabled[type] = (type == "Communication" || type == "Entity");
    });
    setEnabledEventTypes(allEventTypesEnabled);

    // Enable all relationship types
    const allRelationshipTypesEnabled: Record<string, boolean> = {};
    Object.values(relationshipGroups).forEach(group => {
      group.types.forEach(type => {
        allRelationshipTypesEnabled[type] = false;
      });
    });
    setEnabledRelationshipTypes(allRelationshipTypesEnabled);
  };


  return (
    <div className="relative" style={{ minHeight: 40, marginTop: 0, paddingTop: 0 }}>
      {collapsed ? (
        <button
          className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold z-20 whitespace-nowrap"
          onClick={() => setCollapsed(false)}
          style={{ position: "absolute", right: 8, top: 8, minWidth: 45 }}
        >
          Show
        </button>
      ) : (
        <div
          className="border rounded-lg p-4 overflow-y-auto"
          style={{ maxHeight: "400px", position: "relative" }}
        >
          <div className="flex flex-wrap gap-8">
            {/* Node Legend */}
            <div className="min-w-[180px]">
              <h5 className="text-md font-semibold mb-2">Node Legend</h5>
              <ul className="text-sm space-y-1">
                {/* Static Entity node */}
                <li
                  className="cursor-default"
                  style={{ opacity: 1 }}
                >
                  <span
                    className="inline-block w-4 h-4 mr-2 rounded-full"
                    style={{ backgroundColor: "#999999" }}
                  ></span>
                  Entity
                </li>
                {/* Dynamic Event types */}
                {Object.entries(enabledEventTypes).map(([type, isEnabled]) => (
                  <li
                    key={type}
                    onClick={() => handleEventToggle(type)}
                    className={`${
                      type === "Communication" ? "cursor-default" : "cursor-pointer"
                    }`}
                    style={{ opacity: isEnabled || type === "Communication" ? 1 : 0.3 }}
                  >
                    <span
                      className="inline-block w-4 h-4 mr-2 rounded-full"
                      style={{ backgroundColor: getNodeColor(type) }}
                    ></span>
                    {type}
                    <span className="mr-1">({EventMap[type]})</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Edge Legend */}
            <div className="min-w-[220px]">
              <h5 className="text-md font-semibold mb-2">Edge Legend</h5>

            {/* Relationship Edges */}
            <div className="text-sm space-y-2 mb-4">
              <div className="font-semibold text-sm mb-1">Relationship Edges</div>
              {Object.entries(relationshipGroups).map(([groupKey, group]) => {
                const groupDisabled = group.types.every((type) => !enabledRelationshipTypes[type]);

                return (
                  <div key={groupKey}>
                    <div
                      className="font-semibold cursor-pointer"
                      onClick={() => handleGroupToggle(groupKey)}
                      style={{
                        color: group.color,
                        opacity: groupDisabled ? 0.3 : 1,
                      }}
                    >
                      {group.label}
                    </div>
                    <ul className="ml-4 space-y-1">
                      {group.types.map((type) => (
                        <li
                          key={type}
                          onClick={() => handleRelationshipToggle(type)}
                          className="cursor-pointer"
                          style={{ opacity: enabledRelationshipTypes[type] ? 1 : 0.3 }}
                        >
                          <span
                            className="inline-block w-4 h-1 mr-2 align-middle"
                            style={{ backgroundColor: group.color }}
                          ></span>
                          {type}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>


              {/* Event Edges */}
              <div className="text-sm space-y-1">
                <div className="font-semibold text-sm mb-1">Event Edges</div>
                <ul>
                  {Object.entries(EVENT_COLOR_MAP).map(([eventType, color]) => {
                    if (eventType === "Unknown") return null;
                    const isEnabled = enabledEventTypes[eventType];
                    const isCommunication = eventType === "Communication";

                    return (
                      <li
                        key={eventType}
                        onClick={() => handleEventToggle(eventType)}
                        className="cursor-pointer flex items-center space-x-2"
                        style={{ opacity: isEnabled ? 1 : 0.3 }}
                      >
                        <svg
                          width="24"
                          height="5"
                          className="flex-shrink-0"
                        >
                          <line
                            x1="0"
                            y1="3"
                            x2="24"
                            y2="3"
                            stroke={color}
                            strokeWidth="4"
                            strokeDasharray={isCommunication ? "0" : "4,4,4"} // 3 dashes
                          />
                        </svg>
                        <span>{eventType}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>


            </div>
          </div>
        </div>
      )}
      {/* Buttons at the bottom, outside the scrollable area */}
      {!collapsed && (
        <div className="flex justify-between items-center mt-2 px-4 pb-2">
            <button
                className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold whitespace-nowrap"
                onClick={handleEnableAll}
                style={{ minWidth: 45 }}
            >
                Enable All
            </button>
            <button
                className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold whitespace-nowrap"
                onClick={handleDisableAll}
                style={{ minWidth: 45 }}
            >
                Disable All
            </button>
            <button
                className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold whitespace-nowrap"
                onClick={() => setCollapsed(true)}
                style={{ minWidth: 45 }}
            >
                Hide
            </button>
        </div>
      )}
    </div>
  );
};

export default LegendPanel;