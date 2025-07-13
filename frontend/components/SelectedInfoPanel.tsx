import React from "react";

interface SelectedInfoPanelProps {
  selectedInfo: any;
}

const irrelevantKeys = new Set([
  "x", "y", "vx", "vy", "fx", "fy", "index"
]);

const renderEntity = (data: any) => (
  <div className="space-y-1">
    <p><span className="font-medium">Name:</span> {data.name}</p>
    <p><span className="font-medium">Type:</span> {data.type}</p>
    <p><span className="font-medium">Sub-Type:</span> {data.sub_type}</p>
    {data.outgoingCommunicationCount && (
      <p><span className="font-medium">Outgoing Communication edges:</span> {new Date(data.outgoingCommunicationCount).toLocaleString()}</p>
    )}
    {data.incomingCommunicationCount && (
      <p><span className="font-medium">Incoming Communication edges:</span> {new Date(data.incomingCommunicationCount).toLocaleString()}</p>
    )}
  </div>
);

const renderEvent = (data: any) => (
  <div className="space-y-1">
    <p><span className="font-medium">Type:</span> {data.type}</p>
    <p><span className="font-medium">Sub-Type:</span> {data.sub_type}</p>
    {data.timestamp && (
      <p><span className="font-medium">Timestamp:</span> {new Date(data.timestamp).toLocaleString()}</p>
    )}
    {data.content && (
      <p><span className="font-medium">Content:</span> {data.content}</p>
    )}
    {data.monitoring_type && (
      <p><span className="font-medium">Monitoring Type:</span> {data.monitoring_type}</p>
    )}
    {data.findings && (
      <p><span className="font-medium">Findings:</span> {data.findings}</p>
    )}
    {data.assessment_type && (
      <p><span className="font-medium">Assessment Type:</span> {data.assessment_type}</p>
    )}
    {data.results && (
      <p><span className="font-medium">Results:</span> {data.results}</p>
    )}
    {data.movement_type && (
      <p><span className="font-medium">Movement Type:</span> {data.movement_type}</p>
    )}
    {data.destination && (
      <p><span className="font-medium">Destination:</span> {data.destination}</p>
    )}
    {data.enforcement_type && (
      <p><span className="font-medium">Enforcement Type:</span> {data.enforcement_type}</p>
    )}
    {data.outcome && (
      <p><span className="font-medium">Outcome:</span> {data.outcome}</p>
    )}
    {data.activity_type && (
      <p><span className="font-medium">Activity Type:</span> {data.activity_type}</p>
    )}
    {data.participants !== undefined && (
      <p><span className="font-medium">Participants:</span> {data.participants}</p>
    )}
    {data.date && (
      <p><span className="font-medium">Date:</span> {new Date(data.date).toLocaleDateString()}</p>
    )}
    {data.time && (
      <p><span className="font-medium">Time:</span> {data.time}</p>
    )}
    {data.reference && (
      <p><span className="font-medium">Reference:</span> {data.reference}</p>
    )}
    {data.count && (
      <p><span className="font-medium">Number of Evidence:</span> {data.count}</p>
    )}
    {data.count && (
      <p><span>For Evidence content go to "Evidence for Events" in the Communication View</span></p>
    )}
  </div>
);

const renderCommunication = (data: any) => (
  <div className="space-y-1">
    {(data.type) &&(
        <p><span className="font-medium">Type:</span> {data.type}</p>    
    )}
    {(data.sub_type) &&(
      <p><span className="font-medium">Sub-Type:</span> {data.sub_type}</p>
    )}
    {(data.source && data.target) &&(
        <p>Set Filter sender to {data.source} and receiver to {data.target} to display Communications in Communication View at "Sender to Receiver" for better readability.</p>
    )}
    {(data.event_ids && data.timestamps && data.contents && data.count) && 
      Array.isArray(data.event_ids) && Array.isArray(data.timestamps) && Array.isArray(data.contents) && (
        <div className="mt-2 space-y-2">
          <p className="font-medium"> {data.count} Associated Communications:</p>
          {data.event_ids.map((id: string, idx: number) => (
            <div key={`comm-event-${id}-${idx}`} className="ml-2 border-l pl-2 border-gray-300">
              <p><span className="font-semibold">{id}</span></p>
              {data.timestamps[idx] && (
                <p><span className="font-medium">At:</span> {new Date(data.timestamps[idx]).toLocaleString()}</p>
              )}
              {data.contents[idx] && (
                <p><span className="font-medium">Content:</span> {data.contents[idx]}</p>
              )}
            </div>
          ))}
        </div>
      )
    }
    
    {(data.source.id && data.target.id) &&(
      <p><span> This is the edge for {data.target.id}. </span> </p>
    )}
    {(data.source.id && data.target.id) &&(
      <p><span> Please click the node for further information </span> </p>
    )}
    
  </div>
);


const renderRelationship = (data: any) => (
  <div className="space-y-1">
    {(data.source.id && data.target.id) &&(
      <p><span>This is the {data.directed ? "directed" : "undirected"} {data.sub_type}-{data.type} {data.directed ? "from" : "between"}</span> {data.source.id} <span className="text-xs text-gray-500"> ({data.source.sub_type})</span> <span> {data.directed ? "to" : "and"} </span> {data.target.id} <span className="text-xs text-gray-500"> ({data.target.sub_type})</span></p>
    )}
     
    {data.coordination_type && (
      <p><span className="font-medium">Coordination Type:</span> {data.coordination_type}</p>
    )}
    {data.start_date && (
      <p><span className="font-medium">Timestamp:</span> {new Date(data.start_date).toLocaleString()}</p>
    )}
    {data.end_date && (
      <p><span className="font-medium">End Date:</span> {new Date(data.end_date).toLocaleString()}</p>
    )}
    {data.permission_type && (
      <p><span className="font-medium">Permission Type:</span> {data.permission_type}</p>
    )}
    {data.operational_role && (
      <p><span className="font-medium">Operational Role:</span> {data.operational_role}</p>
    )}
    {data.report_type && (
      <p><span className="font-medium">Report Type:</span> {data.report_type}</p>
    )}
    {data.submission_date && (
      <p><span className="font-medium">Submission Date:</span> {new Date(data.submission_date).toLocaleString()}</p>
    )}
    {data.jurisdiction_type && (
      <p><span className="font-medium">Jurisdiction Type:</span> {data.jurisdiction_type}</p>
    )}
    {data.authority_level && (
      <p><span className="font-medium">Authority Level:</span> {data.authority_level}</p>
    )}
    {data.friendship_type && (
      <p><span className="font-medium">Friendship Type:</span> {data.friendship_type}</p>
    )}
    
    {Array.isArray(data.CommIDs) && Array.isArray(data.evidence_contents) && data.CommIDs.length > 0 && (
      <div className="mt-2 space-y-2">
        <p className="font-medium">Found {data.evidence_count} {(data.evidence_count < 2) ? "evidence" : "evidences"} for this Relationship:</p>
        {data.CommIDs.map((id: string, idx: number) => (
          <div key={`evidence-pair-${idx}`} className="ml-2 border-l pl-2 border-gray-300">
            <p><span className="font-semibold">{id}</span></p>
            {data.evidence_contents[idx] && (
              <p><span className="font-medium">Content:</span> {data.evidence_contents[idx]}</p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);



const renderExtraFields = (data: any) => {
  const additionalFields = Object.entries(data).filter(([key]) => !irrelevantKeys.has(key) && key !== "id");
  return (
    <div className="mt-2 space-y-1">
      <p> This is a non-relationship edge. Please click on the node of this edge to display further information. </p>
      <p className="font-semibold">Nonetheless some Info:</p>
      {additionalFields.map(([key, value]) => {
        if (["type", "sub_type", "label", "name", "timestamp", "content"].includes(key)) return null;
        return (
          <p key={key}><span className="font-medium">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : value?.toString()}</p>
        );
      })}
    </div>
  );
};

const SelectedInfoPanel: React.FC<SelectedInfoPanelProps> = ({ selectedInfo }) => {
  const data = selectedInfo?.data;

  return (
    <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
      <h4 className="text-md font-semibold mb-2">Selected Info</h4>
      {data ? (
        <div className="text-sm">
          <h5 className="text-xl font-bold break-all mb-2">{data.id}</h5>
          {data.type === "Entity" && renderEntity(data)}
          {data.type === "Event" && data.sub_type !== "Communication" && renderEvent(data)}
          {data.sub_type === "Communication" && data.is_edge !== "Y" && renderCommunication(data)}
          {data.type === "Relationship" && renderRelationship(data)}
          {data.type !== "Entity" && data.type !== "Event" && data.type !== "Relationship" && renderExtraFields(data)}
          
        </div>
      ) : (
        <p className="text-gray-500 italic">Click a node or edge to view details</p>
      )}
    </div>
  );
};

export default SelectedInfoPanel;
