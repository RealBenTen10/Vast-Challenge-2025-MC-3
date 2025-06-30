"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { GraphData } from "@/components/types";

// Extend Node type to include optional x, y, fx, fy for D3 simulation
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  label?: string;
  sub_type?: string;
  timestamp?: string;
  content?: string;
  findings?: string;
  results?: string;
  destination?: string;
  outcome?: string;
  reference?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  timestamp?: string;
  value?: number;
}

interface GraphDataModified {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface Props {
  graphData: GraphDataModified;
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
  setCommunicationEvents: (nodes: GraphNode[]) => void;
  communicationEvents: GraphNode[];
  setCommunicationEventsAfterTimeFilter: (nodes: GraphNode[]) => void;
  setEventsAfterTimeFilter: (nodes: GraphNode[]) => void;
  communicationEventsAfterTimeFilter: GraphNode[];
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
  setEventsAfterTimeFilter,
  communicationEventsAfterTimeFilter,
  callApi
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stepMS, setStepMS] = useState(60 * 60 * 1000);
  const intervalRef = useRef<number | null>(null);

  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity); // Store current zoom transform

  const controls = (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
      <button onClick={() => setIsPlaying(true)}>▶ Play</button>
      <button onClick={() => setIsPlaying(false)}>⏸ Pause</button>
      <button onClick={() => { setIsPlaying(false); setCurrentIndex(0); }}>⏹ Stop</button>
      <button onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))}>◀ Step Back</button>
      <button onClick={() => setCurrentIndex(i => i + 1)}>Step ▶</button>
      <select value={stepMS / 60000} onChange={e => setStepMS(+e.target.value * 60000)}>
        <option value={1}>1 min</option>
        <option value={10}>10 min</option>
        <option value={60}>1 h</option>
      </select>
    </div>
  );

  useEffect(() => {
    callApi("/read-db-graph");
  }, []);

  // Effect for initializing D3 SVG and zoom, runs only once
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current) return;

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    let g = svg.select<SVGGElement>("g.graph-content"); // Select by class
    if (g.empty()) {
      g = svg.append("g").attr("class", "graph-content"); // Add class
    }

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform; // Store the current transform
      });

    svg.call(zoomBehavior);

    // Apply the stored zoom transform if it exists
    if (zoomTransformRef.current) {
        svg.call(zoomBehavior.transform, zoomTransformRef.current);
    }

  }, [svgRef, graphContainerRef]);


  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current || graphData.nodes.length === 0) return;

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>("g.graph-content"); // Select the existing group

    // Clear existing elements for redraw within the group
    g.selectAll("*").remove();


    const getVisibleNodeIds = (): Set<string> => {
      let visible = new Set<string>();

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        if (filterSender && filterReceiver && filterDepth === 0) {
          visible.add(filterSender);
          visible.add(filterReceiver);

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
                  break;
                }
              }
            }
          });
        } else {
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

      if (filterContent.trim()) {
        const lowerContent = filterContent.toLowerCase();
        const relevantEvents = new Set<string>();
        graphData.nodes.forEach(node => {
          if (node.type === "Event") {
            const fields = ["content", "findings", "results", "destination", "outcome", "reference"];
            if (fields.some(field => (node as any)[field]?.toLowerCase().includes(lowerContent))) {
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

      const visibleSetBeforeTimeFilter = new Set(visible);
      setCommunicationEvents(
        graphData.nodes.filter(n =>
          n.type === "Event" &&
          n.sub_type === "Communication" &&
          visibleSetBeforeTimeFilter.has(n.id)
        )
      );

      if (timestampFilterStart || timestampFilterEnd) {
        visible = new Set(
          Array.from(visible).filter(id => {
            const node = graphData.nodes.find(n => n.id === id);
            if (!node || node.type !== "Event" || !node.timestamp) return true;
            const ts = new Date(node.timestamp);
            const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
            const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;
            return (!start || ts >= start) && (!end || ts <= end);
          })
        );
      }

      const visibleSetAfterTimeFilter = new Set(visible);
      setCommunicationEventsAfterTimeFilter(
        graphData.nodes.filter(n =>
          n.type === "Event" &&
          n.sub_type === "Communication" &&
          visibleSetAfterTimeFilter.has(n.id)
        )
      );

      setEventsAfterTimeFilter(
        graphData.nodes.filter(n =>
          n.type === "Event" &&
          n.sub_type !== "Communication" &&
          visibleSetAfterTimeFilter.has(n.id)
        )
      );

      return visible;
    };

    const visibleIds = getVisibleNodeIds();

    // Create a mutable copy of nodes to allow D3 to set x/y
    let nodesToRender: GraphNode[] = graphData.nodes
        .filter(d => visibleIds.has(d.id))
        .map(d => ({ ...d })); // Deep copy to ensure D3 can modify x, y

    let linksToRender: GraphLink[] = graphData.links.filter(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      const isVisible = visibleIds.has(src) && visibleIds.has(tgt);

      if (!isVisible) return false;

      if (link.type === "COMMUNICATION" && link.timestamp) {
        const ts = new Date(link.timestamp);
        const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
        const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;
        return (!start || ts >= start) && (!end || ts <= end);
      }
      return true;
    }).map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      timestamp: link.timestamp,
      value: link.value || 1
    }));

    // Update counts based on currently visible nodes and links
    const subtypeCounts: Record<string, number> = {};
    nodesToRender.forEach(node => {
      const subtype = node.sub_type || node.label || "Unknown";
      subtypeCounts[subtype] = (subtypeCounts[subtype] || 0) + 1;
    });
    setSubtypeCounts(subtypeCounts);

    const edgeCounts: Record<string, number> = {};
    linksToRender.forEach(link => {
      edgeCounts[link.type] = (edgeCounts[link.type] || 0) + 1;
    });
    setEdgeTypeCounts(edgeCounts);
    setEdgeCount(linksToRender.length);

    // If node positions are not yet set, run simulation
    if (!nodePositions) {
      console.log("Running force simulation...");
      const simulation = d3.forceSimulation<GraphNode, GraphLink>(nodesToRender)
        .force("link", d3.forceLink<GraphNode, GraphLink>(linksToRender).id((d: any) => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(50));

      simulation.on("tick", () => {
        g.selectAll<SVGLineElement, GraphLink>(".link")
          .attr("x1", d => (d.source as GraphNode).x!)
          .attr("y1", d => (d.source as GraphNode).y!)
          .attr("x2", d => (d.target as GraphNode).x!)
          .attr("y2", d => (d.target as GraphNode).y!);

        g.selectAll<SVGGElement, GraphNode>(".node-group")
          .attr("transform", d => `translate(${d.x},${d.y})`);
      });

      simulation.on("end", () => {
        const newPositions: Record<string, { x: number; y: number }> = {};
        nodesToRender.forEach(d => {
          newPositions[d.id] = { x: d.x!, y: d.y! };
        });
        setNodePositions(newPositions);
        console.log("Simulation ended and node positions stored.");
      });

      simulationRef.current = simulation; // Store simulation instance
    } else {
      // If node positions exist, use them and just render
      console.log("Using stored node positions for rendering and filtering.");
      nodesToRender.forEach(node => {
        if (nodePositions[node.id]) {
          node.x = nodePositions[node.id].x;
          node.y = nodePositions[node.id].y;
        } else {
            // If a node is newly introduced by a filter (unlikely in this scenario if all nodes are initially simulated)
            // or if it was filtered out and now brought back, give it a default position or re-run simulation if needed.
            // For this specific requirement, we assume all relevant nodes were part of the initial simulation.
            // For simplicity, we can default to center if a position is not found (though this shouldn't happen with current logic)
            node.x = width / 2;
            node.y = height / 2;
        }
      });
      // Update links to use the fixed positions of visible nodes
      linksToRender.forEach(link => {
        // Ensure source and target are node objects for position access
        const sourceNode = nodesToRender.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodesToRender.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));

        if (sourceNode && targetNode) {
          link.source = sourceNode;
          link.target = targetNode;
        } else {
            // If source or target node is not found in visible nodes, this link should ideally not be rendered.
            // This case should be handled by the initial linksToRender filter, but as a safeguard.
            link.source = { x: 0, y: 0 } as GraphNode; // Placeholder for rendering if node missing
            link.target = { x: 0, y: 0 } as GraphNode; // Placeholder
        }
      });

      // Stop any active simulation if a filter is applied after the initial render
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    }

    // Drawing the links
    const link = g.selectAll<SVGLineElement, GraphLink>(".link")
      .data(linksToRender, d => `${(d.source as GraphNode).id}-${(d.target as GraphNode).id}`) // Use node IDs for join key
      .join(
        enter => enter.append("line")
          .attr("class", "link")
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
          .on("click", (event, d) => setSelectedInfo({ type: "link", data: d })),
        update => update,
        exit => exit.remove()
      );

    // Drawing the nodes
    const node = g.selectAll<SVGGElement, GraphNode>(".node-group")
      .data(nodesToRender, d => d.id)
      .join(
        enter => {
          const group = enter.append("g")
            .attr("class", "node-group")
            .call(d3.drag<SVGGElement, GraphNode>()
              .on("start", (event, d) => {
                if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
                d.fx = null;
                d.fy = null;
                // Update stored positions if dragged
                if (nodePositions) {
                  setNodePositions(prev => ({
                    ...prev,
                    [d.id]: { x: d.x!, y: d.y! }
                  }));
                }
              }))
            .on("mouseover", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
            .on("mouseout", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
            .on("click", (event, d) => {
              setSelectedInfo({ type: "node", data: d });
              if (d.type === "Entity") {
                setFilterSender(d.id);
              }
            });

          group.append("circle")
            .attr("r", 20)
            .attr("fill", d => d.type === "Entity" ? "#999" : d.sub_type === "Communication" ? "#1f77b4" : d.type === "Event" ? "#2ca02c" : "#999");

          group.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("fill", "black")
            .text(d => d.type === "Entity" ? d.id : d.label)
            .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.label)?.length || 0 - 10))}px`);
          return group;
        },
        update => update,
        exit => exit.remove()
      );

    // Manually update positions for both links and nodes if simulation is not running
    if (nodePositions) {
        link
            .attr("x1", d => (d.source as GraphNode).x!)
            .attr("y1", d => (d.source as GraphNode).y!)
            .attr("x2", d => (d.target as GraphNode).x!)
            .attr("y2", d => (d.target as GraphNode).y!);

        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    }

    setVisibleEntities(nodesToRender.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label })));

  }, [
    graphData,
    filterSender,
    filterReceiver,
    filterDepth,
    filterContent,
    timestampFilterStart,
    timestampFilterEnd,
    filterMode,
    nodePositions, // Depend on nodePositions to re-render when they are set
    // No need to include setVisibleEntities, setSubtypeCounts, etc., as they are setters
    // and do not directly influence the D3 rendering logic in this effect.
  ]);

  return (
    <>
      {controls}
    </>
  );
};

export default GraphView;