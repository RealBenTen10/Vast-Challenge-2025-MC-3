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
    color: "#d62728",
    types: ["Suspicious", "Unfriendly"],
  },
  Social: {
    label: "Social",
    color: "#2ca02c",
    types: ["Colleagues", "Friends", "Collaborate"],
  },
  Institutional: {
    label: "Institutional",
    color: "#1f77b4",
    types: ["Jurisdiction", "AccessPermission"],
  },
  Operational: {
    label: "Operational",
    color: "#ff7f0e",
    types: ["Operates", "Coordinates"],
  },
};

const EVENT_COLOR_MAP: Record<string, string> = {
  Monitoring: "#bcbd22",
  Assessment: "#ff7f0e",
  VesselMovement: "#2ca02c",
  Enforcement: "#d62728",
  TourActivity: "#9467bd",
  Collaborate: "#8c564b",
  TransponderPing: "#17becf",
  HarborReport: "#17becf",
  Criticize: "#17becf",
  Communication: "#000",
  Unknown: "#999999",
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
                    return (
                      <li
                        key={eventType}
                        onClick={() => handleEventToggle(eventType)}
                        className="cursor-pointer"
                        style={{ opacity: isEnabled ? 1 : 0.3 }}
                      >
                        <span
                          className="inline-block w-4 h-1 mr-2 align-middle"
                          style={{ backgroundColor: color }}
                        ></span>
                        {eventType}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          
        </div>
      )}
      {/* Hide button conditionally rendered outside the scrollable content */}
      {!collapsed && (
        <button
          className="bg-gray-200 hover:bg-gray-300 rounded px-3 py-1 text-xs font-semibold z-20 whitespace-nowrap"
          onClick={() => setCollapsed(true)}
          style={{ position: "absolute", right: 8, top: 8, minWidth: 45 }}
        >
          Hide
        </button>
      )}
    </div>
  );
};

export default LegendPanel;
