import React from "react";

interface SelectedInfoCardProps {
  selectedInfo: any;
}

const SelectedInfoCard: React.FC<SelectedInfoCardProps> = ({ selectedInfo }) => {
  if (!selectedInfo) {
    return <p className="text-gray-500 italic">Click a node or edge to view details</p>;
  }

  const info = selectedInfo.data;

  const renderRemainingFields = () => {
    const hiddenFields = new Set([
      "id", "label", "type", "sub_type", "name",
      "timestamp", "content", "monitoring_type", "findings",
      "assessment_type", "results", "movement_type", "destination",
      "enforcement_type", "outcome", "activity_type", "participants",
      "permission_type", "start_date", "end_date",
      "x", "y", "vx", "vy", "fx", "fy", "index"
    ]);

    return Object.entries(info)
      .filter(([key]) => !hiddenFields.has(key))
      .map(([key, value]) => (
        <p key={key}>
          <span className="font-medium">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : value?.toString()}
        </p>
      ));
  };

  return (
    <div className="text-sm space-y-1">
      <h5 className="text-lg font-semibold">{info.id}</h5>
      {info.type && <p><span className="font-medium">Type:</span> {info.type}</p>}
      {info.sub_type && <p><span className="font-medium">Sub Type:</span> {info.sub_type}</p>}
      {info.name && <p><span className="font-medium">Name:</span> {info.name}</p>}
      {info.timestamp && <p><span className="font-medium">Timestamp:</span> {info.timestamp}</p>}
      {info.content && <p><span className="font-medium">Content:</span> {info.content}</p>}
      {info.monitoring_type && <p><span className="font-medium">Monitoring Type:</span> {info.monitoring_type}</p>}
      {info.findings && <p><span className="font-medium">Findings:</span> {info.findings}</p>}
      {info.assessment_type && <p><span className="font-medium">Assessment Type:</span> {info.assessment_type}</p>}
      {info.results && <p><span className="font-medium">Results:</span> {info.results}</p>}
      {info.movement_type && <p><span className="font-medium">Movement Type:</span> {info.movement_type}</p>}
      {info.destination && <p><span className="font-medium">Destination:</span> {info.destination}</p>}
      {info.enforcement_type && <p><span className="font-medium">Enforcement Type:</span> {info.enforcement_type}</p>}
      {info.outcome && <p><span className="font-medium">Outcome:</span> {info.outcome}</p>}
      {info.activity_type && <p><span className="font-medium">Activity Type:</span> {info.activity_type}</p>}
      {info.participants && <p><span className="font-medium">Participants:</span> {info.participants}</p>}
      {info.permission_type && <p><span className="font-medium">Permission Type:</span> {info.permission_type}</p>}
      {info.start_date && <p><span className="font-medium">Start Date:</span> {info.start_date}</p>}
      {info.end_date && <p><span className="font-medium">End Date:</span> {info.end_date}</p>}

      {renderRemainingFields()}
    </div>
  );
};

export default SelectedInfoCard;
