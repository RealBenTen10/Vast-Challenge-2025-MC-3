{/* 
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { GraphData, Node, Link } from "@/components/types"; // Assuming Node and Link types are defined here

interface Props {
  graphData: GraphData;
  svgRef: React.RefObject<SVGSVGElement>;
  graphContainerRef: React.RefObject<HTMLDivElement>;
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  filterDepth: number;
  filterContent: string;
  filterMode: string;
  timestampFilterStart: string;
  timestampFilterEnd: string;
  setVisibleEntities: (entities: { id: string; sub_type?: string }[]) => void;
  setSubtypeCounts: (counts: Record<string, number>) => void;
  setEdgeTypeCounts: (counts: Record<string, number>) => void;
  setEdgeCount: (count: number) => void;
  setSelectedInfo: (info: any) => void;
  setCommunicationEvents: (nodes: Node[]) => void;
  communicationEvents: Node[];
  setCommunicationEventsAfterTimeFilter: (nodes: Node[]) => void;
  communicationEventsAfterTimeFilter: Node[];
  callApi: (endpoint: string) => void;
}

const GraphView: React.FC<Props> = ({
  graphData,
  svgRef,
  graphContainerRef,
  filterSender,
  setFilterSender,
  filterReceiver,
  setFilterReceiver,
  filterDepth,
  filterContent,
  filterMode,
  timestampFilterStart,
  timestampFilterEnd,
  setVisibleEntities,
  setSubtypeCounts,
  setEdgeTypeCounts,
  setEdgeCount,
  setSelectedInfo,
  setCommunicationEvents,
  communicationEvents,
  setCommunicationEventsAfterTimeFilter,
  communicationEventsAfterTimeFilter,
  callApi
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stepMS, setStepMS] = useState(60 * 60 * 1000);
  const intervalRef = useRef<number | null>(null);

  // Store the simulation nodes with their x, y coordinates
  const simulationNodesRef = useRef<Node[]>([]);
  // Store the simulation links
  const simulationLinksRef = useRef<Link[]>([]);

  const controls = (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
      <button onClick={() => setIsPlaying(true)}>▶ Play</button>
      <button onClick={() => setIsPlaying(false)}>⏸ Pause</button>
      <button onClick={() => { setIsPlaying(false); setCurrentIndex(0); }}>⏹ Stop</button>
      <button onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))}>◀ Step Back</button>
      <button onClick={() => setCurrentIndex(i => i + 1)}>Step ▶</button>
      <select value={stepMS / 60000} onChange={e => setStepMS(+e.target.value * 60000)}>
        <option value={1}>1 min</option>
        <option value={10}>10 min</option>
        <option value={60}>1 h</option>
      </select>
    </div>
  );

  useEffect(() => {
    callApi("/read-db-graph");
  }, []);

  // --- Effect for initial graph layout and simulation (non-time filters) ---
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current || graphData.nodes.length === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();
    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform)));

    const getBaseVisibleNodeIds = (): Set<string> => {
      let visible = new Set<string>();

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        // show communication events between sender and receiver
        if (filterSender && filterReceiver && filterDepth === 0) {
          visible.add(filterSender);
          visible.add(filterReceiver);

          // Get all event nodes that connect sender and receiver
          graphData.nodes.forEach(node => {
            if (node.type === "Event") {
              let connectedToSender = false;
              let connectedToReceiver = false;

              for (const link of graphData.links) {
                const src = typeof link.source === "string" ? link.source : link.source.id;
                const tgt = typeof link.target === "string" ? link.target : link.target.id;

                if (tgt === node.id && src === filterSender) connectedToSender = true;

                if (src === node.id && tgt === filterReceiver) connectedToReceiver = true;

                if (connectedToSender && connectedToReceiver) {
                  visible.add(node.id);
                  break; // No need to continue checking other links for this node
                }
              }
            }
          });
        } else {
          // Get all nodes connected to the sender/receiver
          // add events
          while (queue.length > 0 && level <= filterDepth) {
            const nextQueue: string[] = [];
            for (const id of queue) {
              if (visible.has(id)) continue;
              visible.add(id);
              const neighbors = graphData.links.flatMap(link => {
                const src = typeof link.source === "string" ? link.source : link.source.id;
                const tgt = typeof link.target === "string" ? link.target : link.target.id;
                return src === id ? [tgt] : tgt === id ? [src] : [];
              });
              nextQueue.push(...neighbors);
            }
            queue.length = 0;
            queue.push(...nextQueue);
            level++;
          }
        }
      } else {
        graphData.nodes.forEach(n => visible.add(n.id));
      }
      // Filter by content
      if (filterContent.trim()) {
        const lowerContent = filterContent.toLowerCase();
        const relevantEvents = new Set<string>();
        graphData.nodes.forEach(node => {
          if (node.type === "Event") {
            const fields = ["content", "findings", "results", "destination", "outcome", "reference"];
            if (fields.some(field => node[field]?.toLowerCase().includes(lowerContent))) {
              relevantEvents.add(node.id);
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
      return visible;
    };

    const baseVisibleIds = getBaseVisibleNodeIds();

    const nodesToSimulate = graphData.nodes
      .filter(d => baseVisibleIds.has(d.id))
      .map(d => ({ ...d })); // Create a shallow copy to prevent direct mutation of graphData

    const linksToSimulate = graphData.links.filter(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      return baseVisibleIds.has(src) && baseVisibleIds.has(tgt);
    }).map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      timestamp: link.timestamp,
      value: link.value || 1
    }));


    // Reset simulationNodesRef and simulationLinksRef
    simulationNodesRef.current = nodesToSimulate;
    simulationLinksRef.current = linksToSimulate;

    setVisibleEntities(nodesToSimulate.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label })));

    const subtypeCounts: Record<string, number> = {};
    nodesToSimulate.forEach(node => {
      const subtype = node.sub_type || node.label || "Unknown";
      subtypeCounts[subtype] = (subtypeCounts[subtype] || 0) + 1;
    });
    setSubtypeCounts(subtypeCounts);

    const edgeCounts: Record<string, number> = {};
    linksToSimulate.forEach(link => {
      edgeCounts[link.type] = (edgeCounts[link.type] || 0) + 1;
    });
    setEdgeTypeCounts(edgeCounts);
    setEdgeCount(linksToSimulate.length);


    const simulation = d3.forceSimulation(nodesToSimulate)
      .force("link", d3.forceLink(linksToSimulate).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(50));

    const linkElements = g.append("g").attr("class", "links")
      .selectAll("line")
      .data(linksToSimulate)
      .enter().append("line")
      .attr("stroke", d => {
        if (d.type === "Suspicious") return "#d62728";
        if (d.type === "Colleagues") return "#2ca02c";
        if (d.type === "Operates") return "#2ca02c";
        if (d.type === "Reports") return "#d62728";
        if (d.type === "Unfriendly") return "#d62728";
        if (d.type === "Friends") return "#2ca02c";
        if (d.type === "Collaborate") return "#2ca02c";
        if (d.type === "Jurisdiction") return "#2ca02c";
        if (d.type === "AccessPermission") return "#2ca02c";
        return "#999";
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      .on("click", (event, d) => setSelectedInfo({ type: "link", data: d }));

    const nodeElements = g.append("g").attr("class", "nodes")
      .selectAll("g")
      .data(nodesToSimulate)
      .enter().append("g")
      .call(d3.drag()
        .on("start", (event, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
      .on("mouseout", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
      .on("click", (event, d: any) => {
        setSelectedInfo({ type: "node", data: d });
        if (d.type === "Entity") {
          setFilterSender(d.id);
        }
      });

    nodeElements.append("circle")
      .attr("r", 20)
      .attr("fill", d => d.type === "Entity" ? "#999" : d.sub_type === "Communication" ? "#1f77b4" : d.type === "Event" ? "#2ca02c" : "#999");

    nodeElements.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "black")
      .text(d => d.type === "Entity" ? d.id : d.label)
      .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.label)?.length - 10))}px`);

    simulation.on("tick", () => {
      linkElements
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      nodeElements.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    simulation.on("end", () => {
      // Store the final positions of nodes
      simulationNodesRef.current = nodesToSimulate.map(d => ({ ...d }));
      // The links also implicitly have their positions updated through their source/target references
      simulationLinksRef.current = linksToSimulate.map(d => ({ ...d }));

      // Ensure nodes are not dragged out of view
      g.selectAll("circle").each(function(d: any) {
        d.x = Math.max(20, Math.min(width - 20, d.x));
        d.y = Math.max(20, Math.min(height - 20, d.y));
      });
      // Now call the updateVisibility to apply time filters based on the settled positions
      updateVisibility(simulationNodesRef.current, simulationLinksRef.current, g, width, height);
    });

    // Clean up function
    return () => {
      simulation.stop();
    };

  }, [
    graphData,
    filterSender,
    filterReceiver,
    filterDepth,
    filterContent,
    filterMode,
  ]);


  // --- Effect for applying time filter (after simulation) ---
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current || simulationNodesRef.current.length === 0) return;

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current);
    const g = svg.select("g");

    updateVisibility(simulationNodesRef.current, simulationLinksRef.current, g, width, height);

  }, [timestampFilterStart, timestampFilterEnd]);

  // Function to apply visibility based on time filters
  const updateVisibility = (nodes: Node[], links: Link[], g: d3.Selection<SVGGElement, unknown, HTMLElement, any>, width: number, height: number) => {
    if (!g || nodes.length === 0) return;

    const currentVisibleNodeIds = new Set<string>();
    const currentVisibleLinkIds = new Set<string>(); // Keep track of links that should be visible

    // Step 1: Identify all nodes that passed the initial non-time filters (these are the nodes in `nodes` array)
    // These `nodes` already reflect `baseVisibleNodeIds` from the simulation useEffect.

    // Step 2: Determine which Event nodes are visible based on the time filter.
    const timeFilteredEventIds = new Set<string>();
    nodes.forEach(node => {
      if (node.type === "Event" && node.timestamp) {
        const ts = new Date(node.timestamp);
        const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
        const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;

        // This logic is correct: include if within the range, or if no range is set
        if ((!start || ts >= start) && (!end || ts <= end)) {
          timeFilteredEventIds.add(node.id);
        }
      }
    });

    // Step 3: Populate currentVisibleNodeIds and currentVisibleLinkIds
    // Start by adding all Entity nodes that came from the base filter.
    nodes.forEach(node => {
      if (node.type === "Entity") {
        currentVisibleNodeIds.add(node.id);
      }
    });

    // Add all time-filtered Event nodes
    timeFilteredEventIds.forEach(id => currentVisibleNodeIds.add(id));

    // Determine which links are visible and ensure connected entities are visible.
    links.forEach(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;

      // Check if both source and target are among the currently considered visible nodes
      const isSrcVisible = currentVisibleNodeIds.has(src);
      const isTgtVisible = currentVisibleNodeIds.has(tgt);

      // Special handling for Communication links based on timestamp
      let isLinkVisibleByTime = true;
      if (link.type === "COMMUNICATION" && link.timestamp) {
        const ts = new Date(link.timestamp);
        const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
        const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;
        isLinkVisibleByTime = (!start || ts >= start) && (!end || ts <= end);
      }

      // A link is visible if its endpoints are in currentVisibleNodeIds AND it passes its own time filter
      if (isSrcVisible && isTgtVisible && isLinkVisibleByTime) {
        currentVisibleLinkIds.add(`${src}-${tgt}`); // Use a unique ID for the link
        // Ensure connected entities are marked visible if they weren't already
        // (This should mostly be handled by initial population, but good for robustness)
        currentVisibleNodeIds.add(src);
        currentVisibleNodeIds.add(tgt);
      }
    });


    // Final adjustment: remove entity nodes that are not connected to any *visible* link
    // (This is a common requirement to prevent floating entities, but can be skipped if you want all base entities always visible)
    // For this scenario, let's keep it simple: if an entity was in baseVisibleNodeIds, and no specific filter removes it, it stays.
    // The logic above ensures entities linked to time-filtered events are kept.

    // --- Apply visibility to SVG elements ---

    // Update node visibility
    g.selectAll<SVGGElement, Node>(".nodes > g")
      .style("display", (d: Node) => currentVisibleNodeIds.has(d.id) ? "block" : "none");

    // Update link visibility
    g.selectAll<SVGLineElement, Link>(".links > line")
      .style("display", (d: Link) => {
        const srcId = typeof d.source === "string" ? d.source : d.source.id;
        const tgtId = typeof d.target === "string" ? d.target : d.target.id;
        return currentVisibleLinkIds.has(`${srcId}-${tgtId}`) ? "block" : "none";
      });

    // Update communication events after time filter application (for the player)
    // This should only include events that are currently *displayed* on the graph due to all filters.
    const visibleCommunicationEventsAfterTimeFilter = nodes
      .filter(n =>
        n.type === "Event" &&
        n.sub_type === "Communication" &&
        currentVisibleNodeIds.has(n.id) // Only if the node itself is visible
      );
    setCommunicationEventsAfterTimeFilter([...visibleCommunicationEventsAfterTimeFilter]);
  };


  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current) return;

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
  }, [svgRef, graphContainerRef]);


  useEffect(() => {
    if (!isPlaying) {
      intervalRef.current && clearInterval(intervalRef.current);
      return;
    }
    const events = [...communicationEventsAfterTimeFilter]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const doStep = () => {
      if (currentIndex >= events.length) { setIsPlaying(false); return; }
      const ev = events[currentIndex];
      // Select elements based on original simulation data and current timestamp
      const related = d3.select(svgRef.current).selectAll(".links > line")
        .filter((d: any) => d.timestamp === ev.timestamp);
      related
        .transition().duration(stepMS / 2)
        .attr("stroke", "#ff7f0e").attr("stroke-width", 4)
        .transition().delay(stepMS / 2).duration(stepMS / 2)
        .attr("stroke", d => d.type === "COMMUNICATION" ? "#2ca02c" : "#999")
        .attr("stroke-width", 1);
      setCurrentIndex(i => i + 1);
    };
    intervalRef.current = setInterval(doStep, stepMS);
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [isPlaying, currentIndex, stepMS, communicationEventsAfterTimeFilter]); // Add communicationEventsAfterTimeFilter to dependency array

  return (
    <>
      {controls}
    </>
  );
};

export default GraphView;

*/}