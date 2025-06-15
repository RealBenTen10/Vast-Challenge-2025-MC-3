"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import MassiveSequenceView from "@/components/MassiveSequenceView";
import Sankey from "@/components/Sankey";
import { Node, Link, GraphData } from "@/components/types";
import { Card, CardHeader, CardBody, Divider, Button, Alert, Switch } from "@heroui/react";
import React, { ReactElement, useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { sankey, sankeyLinkHorizontal, SankeyGraph } from 'd3-sankey';


export default function Home() {
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [useAggregated, setUseAggregated] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);  // Add timeSeriesRef

  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});
  const [edgeTypeCounts, setEdgeTypeCounts] = useState<Record<string, number>>({});  // Track edge types
  const [edgeCount, setEdgeCount] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"all" | "event" | "relationship">("all");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterDepth, setFilterDepth] = useState<number>(1);
  const [visibleEntities, setVisibleEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<any>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sankeyData, setSankeyData] = useState<{ source: string, target: string, value: number }[]>([]);
  const [filterContent, setFilterContent] = useState<string>("");


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
  let visible = new Set<string>();

  // 1️⃣ Entity Filter + Depth
  if (filterEntityId) {
    const queue = [filterEntityId];
    let level = 0;

    while (queue.length > 0 && level <= filterDepth) {
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visible.has(id)) continue;
        visible.add(id);

        const neighbors = graphData.links
          .filter(link => {
            const src = typeof link.source === "string" ? link.source : link.source.id;
            const tgt = typeof link.target === "string" ? link.target : link.target.id;
            return src === id || tgt === id;
          })
          .map(link => {
            const src = typeof link.source === "string" ? link.source : link.source.id;
            const tgt = typeof link.target === "string" ? link.target : link.target.id;
            return src === id ? tgt : src;
          });

        nextQueue.push(...neighbors);
      }
      queue.length = 0;
      queue.push(...nextQueue);
      level++;
    }
  } else {
    graphData.nodes.forEach(node => visible.add(node.id));
  }

  // 2️⃣ Content Filter
  if (filterContent && filterContent.trim() !== "") {
    const contentLower = filterContent.toLowerCase();
    const relevantEvents = new Set<string>();

    graphData.nodes.forEach(node => {
      if (node.type === "Event") {
        const fields = ["content", "findings", "results", "destination", "outcome", "reference"];
        for (const field of fields) {
          if (node[field] && String(node[field]).toLowerCase().includes(contentLower)) {
            relevantEvents.add(node.id);
            break;
          }
        }
      }
    });

    const connectedEntities = new Set<string>();
    graphData.links.forEach(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      if (relevantEvents.has(src) && graphData.nodes.find(n => n.id === tgt)?.type === "Entity") connectedEntities.add(tgt);
      if (relevantEvents.has(tgt) && graphData.nodes.find(n => n.id === src)?.type === "Entity") connectedEntities.add(src);
    });

    visible = new Set(
      Array.from(visible).filter(id => {
        const node = graphData.nodes.find(n => n.id === id);
        if (!node) return false;
        if (node.type === "Entity") return connectedEntities.has(id);
        if (node.type === "Event") return relevantEvents.has(id);
        return true;
      })
    );
  }

  // 3️⃣ Timestamp Filter (applies only to Events, keeps all Entities/Relationships)
  if (selectedTimestamp && selectedTimestamp.trim() !== "") {

    visible = new Set(
      Array.from(visible).filter(id => {
        const node = graphData.nodes.find(n => n.id === id);
        if (!node) return true;
        if (node.type === "Event") return node.timestamp?.startsWith(selectedTimestamp);
        return true; // Entities/Relationships always kept
      })
    );
  }

  return visible;
};

    const visibleIds = getVisibleNodeIds();
    const nodes = graphData.nodes.filter(d =>
      visibleIds.has(d.id) &&
      (d.type === "Entity" || filterMode === "all" || (filterMode === "event" && d.type === "Event") || (filterMode === "relationship" && d.type === "Relationship"))
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
        timestamp: link.timestamp,
        value: link.value || 1
      }));

    const counts: Record<string, number> = {};
    nodes.forEach((node: any) => {
      const subtype = node.sub_type || node.label || "Unknown";
      counts[subtype] = (counts[subtype] || 0) + 1;
    });
    setSubtypeCounts(counts);

    const edgeCounts: Record<string, number> = {};
    links.forEach(link => {
      const type = link.type || "OTHER";
      edgeCounts[type] = (edgeCounts[type] || 0) + 1;
    });
    setEdgeTypeCounts(edgeCounts);
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
        if (d.type === "COMMUNICATION") return "#2ca02c";
        if (d.type === "EVIDENCE_FOR") return "#800080";
        if (d.type && d.type.match(/AccessPermission|Operates|Colleagues|Suspicious|Reports|Jurisdiction|Unfriendly|Friends/)) return "brown";
        return "#999";
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      .on("click", (event, d) => {
        setSelectedInfo({ type: "link", data: d });
      });

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4);
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget).select("circle").attr("stroke", "none");
      })
      .on("click", (event, d) => {
        setSelectedInfo({ type: "node", data: d });
      });

    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => {
        switch (d.type) {
          case "Entity": return "#1f77b4";
          case "Event": return "#2ca02c";
          case "Relationship": return "#d62728";
          default: return "#999999";
        }
      });

    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "black")
      .text((d: any) => d.type === "Entity" ? d.id : d.label)
      .style("font-size", (d: any) => {
        const label = d.type === "Entity" ? d.id : d.label;
        const baseSize = 12;
        const maxLength = 10;
        return `${Math.max(8, baseSize - (label.length - maxLength))}px`;
      });

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => (d.source as any).x)
          .attr("y1", (d: any) => (d.source as any).y)
          .attr("x2", (d: any) => (d.target as any).x)
          .attr("y2", (d: any) => (d.target as any).y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
  };
  

  const drawTimeSeries = () => {
  if (!timeSeriesRef.current) return;
  d3.select(timeSeriesRef.current).selectAll("*").remove();

  const timestamps: string[] = graphData.nodes
    .filter(node => node.type?.toLowerCase() === "event" && node.timestamp)
    .map(node => node.timestamp);

  if (timestamps.length === 0) return;

  const parsedDates = timestamps.map(ts => new Date(ts)).filter(d => !isNaN(d.getTime()));
  const dateCounts: Record<string, number> = {};
  parsedDates.forEach(date => {
    const day = date.toISOString().split("T")[0];
    dateCounts[day] = (dateCounts[day] || 0) + 1;
  });

  const data = Object.entries(dateCounts).map(([date, count]) => ({ date: new Date(date), count }));

  const svg = d3.select(timeSeriesRef.current);
  const width = svg.node()?.clientWidth || 600;
  const height = svg.node()?.clientHeight || 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleTime().domain(d3.extent(data, d => d.date) as [Date, Date]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).nice().range([innerHeight, 0]);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5));

  g.append("g").call(d3.axisLeft(y));

  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "4px 8px")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", d => x(d.date) - 4)
    .attr("y", d => y(d.count))
    .attr("width", 8)
    .attr("height", d => innerHeight - y(d.count))
    .attr("fill", "#1f77b4")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#ff7f0e");
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`<strong>${d.date.toISOString().split("T")[0]}</strong><br/>Count: ${d.count}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#1f77b4");
      tooltip.transition().duration(500).style("opacity", 0);
    })
    .on("click", (event, d) => {
      const clickedDate = d.date.toISOString().split("T")[0];
      setSelectedTimestamp(clickedDate);
    });

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "black")
    .text("Date");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -30)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "black")
    .text("Event Count");
};


  useEffect(() => {
    if (graphData.nodes.length > 0) {
      drawGraph();
      drawTimeSeries();
    }
  }, [graphData, filterMode, filterEntityId, filterDepth, filterContent, selectedTimestamp]);

  const [timeSeriesData, setTimeSeriesData] = useState<{ date: string, count: number }[]>([]);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const dateCounts: Record<string, number> = {};
      graphData.nodes.forEach((node) => {
        if (node.type === "Event" && node.timestamp) {
          const dateStr = node.timestamp.split("T")[0]; // Get YYYY-MM-DD
          dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
        }
      });
      const processed = Object.entries(dateCounts).map(([date, count]) => ({ date, count }));
      setTimeSeriesData(processed);
    }
  }, [graphData]);




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

    {/* Top Row: Filters + Graph Summary + Selected Info */}
    <div className="flex w-full max-w-7xl gap-4">
      {/* Filters and Actions */}
      <Card className="w-[400px] flex-shrink-0">
        <CardHeader>
          <h3 className="text-lg">Neo4j Graph Actions</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <Button onPress={() => callApi("/load-graph-json")} className="mt-2" color="primary">Load JSON Graph</Button>
          <div className="mt-4">
            <label className="text-sm font-medium">Filter by Event Subtype(s):</label>
            <select
              multiple
              className="mt-1 block w-full border rounded px-2 py-1 text-sm"
              value={selectedEventTypes}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedEventTypes(options);
              }}
            >
              <option value="Communication">Communication</option>
              <option value="VesselMovement">Vessel Movement</option>
              <option value="Inspection">Inspection</option>
              <option value="Delivery">Delivery</option>
              <option value="Permit">Permit</option>
              {/* Add other Event subtypes as needed */}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium">Filter by Entity ID:</label>
            <input
              className="mt-1 block w-full border rounded px-2 py-1 text-sm"
              type="text"
              value={filterEntityId}
              onChange={(e) => setFilterEntityId(e.target.value)}
              placeholder="e.g., Boss"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium">Filter by Message Content:</label>
            <input
              className="mt-1 block w-full border rounded px-2 py-1 text-sm"
              type="text"
              value={filterContent}
              onChange={(e) => setFilterContent(e.target.value)}
              placeholder="e.g., permit approval"
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

          <Button onPress={loadGraph} className="mt-2" color="success">Show Graph</Button>
          <Alert isVisible={!!statusMsg} color="info" title="Status" description={statusMsg} className="mt-4" />
        </CardBody>
      </Card>

      {/* Graph Summary */}
      <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
        <h4 className="text-md font-semibold mb-2">Graph Summary</h4>
        <h5 className="text-sm font-semibold mb-2">Edge Summary</h5>
        <p className="text-sm mb-2"><span className="font-medium">Total Edges:</span> {edgeCount}</p>
        <ul className="list-disc list-inside text-sm space-y-1">
          {Object.entries(edgeTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <li key={type}><span className="font-medium">{type}</span>: {count}</li>
          ))}
        </ul>

        <h5 className="text-sm font-semibold mt-4 mb-2">Node Summary</h5>
        <ul className="list-disc list-inside text-sm space-y-1">
          {Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1]).map(([subtype, count]) => (
            <li key={subtype}><span className="font-medium">{subtype}</span>: {count}</li>
          ))}
        </ul>
      </div>

      {/* Selected Info */}
      <div className="w-[300px] flex-shrink-0 border rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
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

    {/* Graph Container */}
    <div ref={graphContainerRef} className="flex-1 border rounded-lg mt-6" style={{ height: "600px", width: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>

    {filterEntityId && (
      <Sankey entityId={filterEntityId} selectedDate={selectedTimestamp} />
    )}

    {/* Time Series Chart */}
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Communication Time Series</h4>
      <svg ref={timeSeriesRef} className="w-full h-60"></svg>
    </div>

    {/* Legends */}
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
    <MassiveSequenceView className="mt-6" />
    
  </section>
);

  
}
