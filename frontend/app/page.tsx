"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import EntityGrouping from "@/components/EntityGrouping";
import { Card, CardHeader, CardBody, Divider, Button, Alert, Switch } from "@heroui/react";
import React, { ReactElement, useEffect, useState, useRef } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  label: string;
  type?: string;
  group?: number;
  degree?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: string;
  value?: number;
  aggregatedEvents?: string[];
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [useAggregated, setUseAggregated] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});
  const [edgeCount, setEdgeCount] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"all" | "event" | "relationship">("all");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterDepth, setFilterDepth] = useState<number>(1);
  const [visibleEntities, setVisibleEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<any>(null);
  const [groupId, setGroupId] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  console.log("graphData nodes", graphData.nodes);


  const groupEntities = async () => {
    const groupId = prompt("Neue Gruppen-ID?");
    const entityInput = prompt("Kommaseparierte Entity-IDs?");
    if (!groupId || !entityInput) return;

    try {
      const res = await fetch(`/api/group-by?group_id=${groupId}&entity_ids=${entityInput}`);
      const data = await res.json();

      if (!data.success || !data.nodes || !data.links) {
        setStatusMsg(data.message || "Ungültige Antwort vom Backend.");
        return;
      }

      setGraphData({
        nodes: data.nodes,
        links: data.links
      });

      setStatusMsg(`Group ${groupId} erfolgreich hinzugefügt.`);
    } catch (err) {
      setStatusMsg("Fehler beim Gruppieren: " + err);
    }
  };

  const handleGroup = async () => {
    setStatusMsg("Grouping...");
    try {
      const res = await fetch(
        `/api/group-by?group_id=${encodeURIComponent(groupId)}&entity_ids=${encodeURIComponent(groupMembers)}`
      );
      const data = await res.json();
      if (data.success && data.nodes && data.links) {
        setGraphData({ nodes: data.nodes, links: data.links });
        setStatusMsg(`Success: ${data.message}`);
      } else {
        setStatusMsg(`Error: ${data.message || "Ungültige Antwort vom Backend."}`);
      }
    } catch (err) {
      setStatusMsg(`Error Grouping: ${err}`);
    }
  };


  const drawGraph = () => {
    if (!svgRef.current || !graphContainerRef.current) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const width = graphContainerRef.current.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform)));

  const getVisibleNodeIds = (): Set<string> => {
    const visible = new Set<string>();

    if (!filterEntityId) {
      graphData.nodes.forEach(node => {
        if (node.type === "Entity") visible.add(node.id);
        if (filterMode === "all") visible.add(node.id);
        if (filterMode === "event" && node.type === "Event") visible.add(node.id);
        if (filterMode === "relationship" && node.type === "Relationship") visible.add(node.id);
      });
      return visible;
    }

  
    const queue = [filterEntityId];
    const visited = new Set<string>();
    let level = 0;

    while (queue.length > 0 && level <= filterDepth) {
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue;
        visited.add(id);
        visible.add(id);

        const neighbors = graphData.links
          .filter(link => link.source === id || link.target === id)
          .map(link => (link.source === id ? link.target : link.source));

        nextQueue.push(...(neighbors as string[]));
      }
      queue.length = 0;
      queue.push(...nextQueue);
      level++;
    }

    return visible;
  };

  const visibleIds = getVisibleNodeIds();

  const nodes = graphData.nodes.filter(d =>
    visibleIds.has(d.id) &&
    (
      d.type === "Entity" ||
      filterMode === "all" ||
      (filterMode === "event" && d.type === "Event") ||
      (filterMode === "relationship" && d.type === "Relationship")
    )
  );

  const visibleEntityList = nodes
    .filter(d => d.type === "Entity")
    .map(d => ({ id: d.id, sub_type: d.label }));

  setVisibleEntities(visibleEntityList);

  const links = graphData.links
    .filter(link =>
      visibleIds.has(typeof link.source === "string" ? link.source : link.source.id) &&
      visibleIds.has(typeof link.target === "string" ? link.target : link.target.id)
    )
    .map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      value: link.value || 1
    }));

    // Recompute node subtype counts
    const counts: Record<string, number> = {};
    nodes.forEach((node: any) => {
      const subtype = node.sub_type || node.label || "Unknown";
      counts[subtype] = (counts[subtype] || 0) + 1;
    });
    setSubtypeCounts(counts);

    // Update edge count
    setEdgeCount(links.length);


    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(50));

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", (d: any) => {
        if (d.type === "COMMUNICATION") return "#2ca02c";  // Green for Communication
        if (d.type === "EVIDENCE_FOR") return "#800080";    // Purple for Evidence links
        if (d.type && d.type.match(/AccessPermission|Operates|Colleagues|Suspicious|Reports|Jurisdiction|Unfriendly|Friends/)) {
          return "brown";  // Brown for Relationship edges
        }
        return "#999";  // Gray fallback
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1);
    link.on("click", (event, d) => {
        setSelectedInfo({ type: "link", data: d });
      });
      

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })      
      )
      .on ("mouseover", (event, d) => {
        d3.select(event.currentTarget)
        .select("circle")
        .attr("stroke", "purple")
        .attr("stroke-width", 4);
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget)
        .select("circle")
        .attr("stroke", "none");
      })
      .on("click", (event, d) => {
      setSelectedInfo({ type: "node", data: d });
      });

    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => {
        if (d.id === groupId) return "gold"; 
        if (d.type === "Entity") return "#1f77b4";
        if (d.type === "Event") return "#2ca02c";
        if (d.type === "Relationship") return "#d62728";
        return "#999999";
      });


      node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "black")
      .text((d: any) => {
        if (d.type === "Entity") return d.id;
        return d.label;
      })
      .style("font-size", (d: any) => {
        const label = d.type === "Entity" ? d.id : d.label;
        const baseSize = 12;
        const maxLength = 10;
        return `${Math.max(8, baseSize - (label.length - maxLength))}px`;
      });

      const legendData = [
        { type: "Entity", color: "#1f77b4" },
        { type: "Event", color: "#2ca02c" },
        { type: "Relationship", color: "#d62728" }
      ];

      const edgeLegendData = [
        { type: "Communication", color: "#2ca02c" },
        { type: "Evidence For", color: "#800080" },
        { type: "Relationship", color: "brown" },
        { type: "Related To", color: "#999" },
      ];    

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => (d.source as any).x)
          .attr("y1", (d: any) => (d.source as any).y)
          .attr("x2", (d: any) => (d.target as any).x)
          .attr("y2", (d: any) => (d.target as any).y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
  };

  useEffect(() => {
    if (graphData.nodes.length > 0) drawGraph();
  }, [graphData, filterMode, filterEntityId, filterDepth]);
  
  

  const callApi = async (endpoint: string) => {
    setStatusMsg(`Calling ${endpoint}...`);
    try {
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      setStatusMsg(data.message || JSON.stringify(data));
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };

  

  const loadGraph = async () => {
    try {
      const endpoint = useAggregated ? "/read-db-graph" : "/read-db-graph";
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      if (data.success) setGraphData({ nodes: data.nodes, links: data.links });
      else setStatusMsg(data["error-message"]);
    } catch (err) {
      setStatusMsg(`Graph loading failed: ${err}`);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
  
      {/* Filter + Entity list side-by-side */}
      <div className="flex w-[1400px] gap-4">
        {/* Filter + Actions */}
        <Card className="w-[500px]">
          <CardHeader>
            <h3 className="text-lg">Neo4j Graph Actions</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">Load JSON Graph</Button>  
            <div className="mt-4">
              <label className="text-sm font-medium">Filter visible node types:</label>
              <select
                className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
              >
                <option value="all">Show Events & Relationships</option>
                <option value="event">Show Events Only</option>
                <option value="relationship">Show Relationships Only</option>
              </select>
            </div>
  
            <div className="mt-4">
              <label className="text-sm font-medium">Filter by Entity ID:</label>
              <input
                className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                type="text"
                value={filterEntityId}
                onChange={(e) => setFilterEntityId(e.target.value)}
                placeholder="e.g., E001"
              />
            </div>
  
            <div className="mt-2">
              <label className="text-sm font-medium">Neighbor Depth (n):</label>
              <input
                className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                type="number"
                min={0}
                max={9}
                value={filterDepth}
                onChange={(e) => setFilterDepth(Number(e.target.value))}
              />
            </div>
  
            <div className="mt-4 flex items-center gap-2">
              <Switch isSelected={useAggregated} onValueChange={setUseAggregated} />
              <span>Use Aggregated View</span>
            </div>
            <Button onPress={loadGraph} className="mt-2" color="success">Show Graph</Button>

            {/* Entity Grouping*/}
          <EntityGrouping
            groupId={groupId}
            groupMembers={groupMembers}
            onGroupIdChange={setGroupId}
            onGroupMembersChange={setGroupMembers}
            onGroup={handleGroup}
          />

            <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />
            
          </CardBody>
        </Card>
  
        {/* Visible Entity List */}
        <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "600px" }}>
          <h4 className="text-md font-semibold mb-2">Visible Entities: {visibleEntities.length}</h4>
          <ul className="list-disc list-inside text-sm space-y-1">
            {visibleEntities.length === 0 ? (
              <li className="text-gray-500 italic">No entities visible</li>
            ) : (
              visibleEntities.map(entity => (
                <li key={entity.id}>
                  <span className="font-medium">{entity.sub_type ?? "Entity"}</span>: {entity.id}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
  
      {/* Graph and Summary */}
      <div className="mt-10 w-full max-w-7xl flex gap-6">
        {/* Graph container */}
        <div ref={graphContainerRef} className="flex-1 border rounded-lg" style={{ height: "600px" }}>
          <svg ref={svgRef} className="w-full h-full"></svg>
        </div>

        {/* Subtype summary box */}
        <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "600px" }}>
          <h4 className="text-md font-semibold mb-2">Graph Summary</h4>
  
          {/* Edge count */}
          <h5 className="text-sm font-semibold mb-2">Edge Summary</h5>
          <p className="text-sm mb-4">
            <span className="font-medium">Total Edges:</span> {edgeCount}
          </p>
  
          {/* Node subtype counts */}
          <h5 className="text-sm font-semibold mb-2">Node Summary</h5>
          <ul className="list-disc list-inside text-sm space-y-1">
            {Object.entries(subtypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([subtype, count]) => (
                <li key={subtype}>
                  <span className="font-medium">{subtype}</span>: {count}
                </li>
              ))}
          </ul>
        </div>
        {/* Clicked Node/Edge Info */}
        <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "600px" }}>
          <h4 className="text-md font-semibold mb-2">Selected Info</h4>
          {selectedInfo ? (
            <div className="text-sm space-y-1">
              <h5 className="text-lg font-semibold">{selectedInfo.data.id}</h5>
              {selectedInfo.data.type && <p><span className="font-medium">Type:</span> {selectedInfo.data.type}</p>}
              {selectedInfo.data.sub_type && <p><span className="font-medium">Sub Type:</span> {selectedInfo.data.sub_type}</p>}
              {selectedInfo.data.name && <p><span className="font-medium">Name:</span> {selectedInfo.data.name}</p>}

              {/* Optional fields */}
              {selectedInfo.data.timestamp && <p><span className="font-medium">Timestamp:</span> {selectedInfo.data.timestamp}</p>}
              {selectedInfo.data.content && <p><span className="font-medium">Content:</span> {selectedInfo.data.content}</p>}
              {selectedInfo.data.monitoring_type && <p><span className="font-medium">Monitoring Type:</span> {selectedInfo.data.monitoring_type}</p>}
              {selectedInfo.data.findings && <p><span className="font-medium">Findings:</span> {selectedInfo.data.findings}</p>}
              {selectedInfo.data.assessment_type && <p><span className="font-medium">Assessment Type:</span> {selectedInfo.data.assessment_type}</p>}
              {selectedInfo.data.results && <p><span className="font-medium">Results:</span> {selectedInfo.data.results}</p>}
              {selectedInfo.data.movement_type && <p><span className="font-medium">Movement Type:</span> {selectedInfo.data.movement_type}</p>}
              {selectedInfo.data.destination && <p><span className="font-medium">Destination:</span> {selectedInfo.data.destination}</p>}
              {selectedInfo.data.enforcement_type && <p><span className="font-medium">Enforcement Type:</span> {selectedInfo.data.enforcement_type}</p>}
              {selectedInfo.data.outcome && <p><span className="font-medium">Outcome:</span> {selectedInfo.data.outcome}</p>}
              {selectedInfo.data.activity_type && <p><span className="font-medium">Activity Type:</span> {selectedInfo.data.activity_type}</p>}
              {selectedInfo.data.participants && <p><span className="font-medium">Participants:</span> {selectedInfo.data.participants}</p>}
              {selectedInfo.data.permission_type && <p><span className="font-medium">Permission Type:</span> {selectedInfo.data.permission_type}</p>}
              {selectedInfo.data.start_date && <p><span className="font-medium">Start Date:</span> {selectedInfo.data.start_date}</p>}
              {selectedInfo.data.end_date && <p><span className="font-medium">End Date:</span> {selectedInfo.data.end_date}</p>}

              {/* Display any remaining fields */}
              {Object.entries(selectedInfo.data)
                .filter(([key]) =>
                  ![
                    "id", "label", "type", "sub_type", "name",
                    "timestamp", "content", "monitoring_type", "findings",
                    "assessment_type", "results", "movement_type", "destination",
                    "enforcement_type", "outcome", "activity_type", "participants",
                    "permission_type", "start_date", "end_date",
                    "x", "y", "vx", "vy", "fx", "fy", "index"
                  ].includes(key)
                )
                .map(([key, value]) => (
                  <p key={key}><span className="font-medium">{key}:</span> {typeof value === "object" ? JSON.stringify(value) : value?.toString()}</p>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Click a node or edge to view details</p>
          )}

        </div>

      </div>

      {/* Legends below the graph */}
      <div className="mt-4 flex flex-wrap gap-8">
        {/* Node Legend */}
        <div className="border rounded-lg p-4">
          <h5 className="text-md font-semibold mb-2">Node Legend</h5>
          <ul className="text-sm space-y-1">
            <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#1f77b4" }}></span>Entity</li>
            <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#2ca02c" }}></span>Event</li>
            <li><span className="inline-block w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: "#d62728" }}></span>Relationship</li>
          </ul>
        </div>

        {/* Edge Legend */}
        <div className="border rounded-lg p-4">
          <h5 className="text-md font-semibold mb-2">Edge Legend</h5>
          <ul className="text-sm space-y-1">
            <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#2ca02c" }}></span>Communication</li>
            <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#800080" }}></span>Evidence For</li>
            <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "brown" }}></span>Relationship</li>
            <li><span className="inline-block w-4 h-1 mr-2 align-middle" style={{ backgroundColor: "#999" }}></span>Other</li>
          </ul>
        </div>
      </div>


  
    </section>
  );
  
}
