"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { GraphData, Node, Link } from "@/components/types";
import LegendPanel from "./LegendPanel"; 

// Extend Node type to include optional x, y, fx, fy for D3 simulation
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  label?: string;
  sub_type?: string;
  timestamp?: string; // Events have timestamps
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
  timestamp?: string; // Links can also have timestamps, especially 'COMMUNICATION'
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
  relevantEvents: Set<string>;
  setrelevantEvents: (events: Set<string>) => void;
  filterEntityId: string;
  selectedTimestamp: string | null;
  highlightedMessageId?: string | null;
  graphHeight: number;
  commGraphData: GraphDataModified;
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
  filterEntityId,
  timestampFilterStart: propTimestampFilterStart,
  timestampFilterEnd: propTimestampFilterEnd,
  selectedTimestamp,
  setVisibleEntities,
  setSubtypeCounts,
  setEdgeTypeCounts,
  setEdgeCount,
  setSelectedInfo,
  highlightedMessageId,
  graphHeight,
  setCommunicationEvents,
  communicationEvents,
  setCommunicationEventsAfterTimeFilter,
  setEventsAfterTimeFilter,
  communicationEventsAfterTimeFilter,
  callApi,
  relevantEvents,
  setrelevantEvents,
  commGraphData
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepMS, setStepMS] = useState(60 * 60 * 1000); // Default to 1 hour
  const intervalRef = useRef<number | null>(null);

  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity); // Store current zoom transform

  // Animation state
  const defaultStartDate = new Date("2040-10-01T00:00:00").getTime();
  const defaultEndDate = new Date("2040-10-15T00:00:00").getTime();
  
  const [animationStartTime, setAnimationStartTime] = useState<number>(defaultStartDate);
  const [animationEndTime, setAnimationEndTime] = useState<number>(defaultEndDate);
  const [currentAnimationTime, setCurrentAnimationTime] = useState<number>(defaultStartDate);

  const DEFAULT_RADIUS = 20;
  const HIGHLIGHT_RADIUS = 30;

  const getEntityRadius = (id: string) => {
      // Zähle alle CommunicationAggregate-Nodes, die mit dieser Entity verbunden sind
      let commCount = 0;
      graphData.links.forEach((link: any) => {
        const src = typeof link.source === "string" ? link.source : link.source.id;
        const tgt = typeof link.target === "string" ? link.target : link.target.id;
        // Prüfe, ob die Entity beteiligt ist und die andere Seite ein CommunicationAggregate ist
        if (src === id) {
          const tgtNode = graphData.nodes.find((n: any) => n.id === tgt && n.type === "Communication");
          if (tgtNode) commCount++;
        }
        if (tgt === id) {
          const srcNode = graphData.nodes.find((n: any) => n.id === src && n.type === "Communication");
          if (srcNode) commCount++;
        }
      });
      return DEFAULT_RADIUS + 1.5 * (Math.max(1, commCount) - 1);
    };

  // Parse prop timestamps for initial animation range
  useEffect(() => {
    const start = propTimestampFilterStart ? new Date(propTimestampFilterStart).getTime() : defaultStartDate;
    const end = propTimestampFilterEnd ? new Date(propTimestampFilterEnd).getTime() : defaultEndDate;
    setAnimationStartTime(start);
    setAnimationEndTime(end);
    setCurrentAnimationTime(start); // Reset animation to start when time filter props change
  }, [propTimestampFilterStart, propTimestampFilterEnd]);


  // Effect for animation loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentAnimationTime(prevTime => {
          const nextTime = prevTime + stepMS;
          if (nextTime > animationEndTime) {
            setIsPlaying(false); // Stop when end is reached
            return animationStartTime; // Loop back to start
          }
          return nextTime;
        });
      }, 500); // Animation update rate (adjust as needed)
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, stepMS, animationStartTime, animationEndTime]);

  useEffect(() => {
      if (!svgRef.current || !graphContainerRef.current) return;
      const width = graphContainerRef.current.clientWidth;
      const height = graphHeight || 500;
      d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);
    }, [graphHeight, graphContainerRef]);

  const handleStep = useCallback((direction: 'forward' | 'backward') => {
    setIsPlaying(false); // Pause animation on manual step
    setCurrentAnimationTime(prevTime => {
      let newTime = prevTime;
      if (direction === 'forward') {
        newTime = prevTime + stepMS;
        if (newTime > animationEndTime) {
          return animationStartTime; // Loop if past end
        }
      } else {
        newTime = prevTime - stepMS;
        if (newTime < animationStartTime) {
          return animationEndTime; // Loop if before start
        }
      }
      return newTime;
    });
  }, [stepMS, animationStartTime, animationEndTime]);

  const controls = (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
      <button onClick={() => setIsPlaying(true)}>▶ Play</button>
      <button onClick={() => setIsPlaying(false)}>⏸ Pause</button>
      <button onClick={() => { setIsPlaying(false); setCurrentAnimationTime(animationStartTime); }}>⏹ Stop</button>
      <button onClick={() => handleStep('backward')}>◀ Step Back</button>
      <button onClick={() => handleStep('forward')}>Step ▶</button>
      <select value={stepMS / 60000} onChange={e => setStepMS(+e.target.value * 60000)}>
        <option value={1}>1 min</option>
        <option value={10}>10 min</option>
        <option value={60}>1 h</option>
        <option value={24 * 60}>1 day</option>
      </select>
      {/* <div style={{marginTop: '10px', color: 'white'}}>
        Current Time: {new Date(currentAnimationTime).toLocaleString()}
      </div> */}
    </div>
  );

  useEffect(() => {
    callApi("/read-db-graph");
  }, []);

  
  


  // Effect for initializing D3 SVG and zoom, runs only once
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current) return;

    const width = graphContainerRef.current.clientWidth;
    const height = graphHeight || 500;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("defs").append("marker") 
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

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
    if (!svgRef.current || !graphContainerRef.current || commGraphData.nodes.length === 0) return;

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>("g.graph-content"); // Select the existing group

    const getVisibleNodeIds = (): Set<string> => {
      let visible = new Set<string>();

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        if (filterSender && filterReceiver && filterDepth === 0) {
          visible.add(filterSender);
          visible.add(filterReceiver);

          // Iterate through all links to find communication events between sender and receiver (bidirectional)
          graphData.links.forEach(link => {
            const srcId = typeof link.source === "string" ? link.source : link.source.id;
            const tgtId = typeof link.target === "string" ? link.target : link.target.id;

            // Find the event node connected to this link, if any
            const eventNode = graphData.nodes.find(n => n.id === srcId && n.type === "Event") ||
                              graphData.nodes.find(n => n.id === tgtId && n.type === "Event");
            
            // Check if this is a "Communication" event and it links sender/receiver
            if (eventNode && eventNode.sub_type === "Communication") {
                // Scenario 1: Sender -> Event -> Receiver
                const linkFromSender = graphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === filterSender && (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id);
                const linkToReceiver = graphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id && (typeof l.target === 'string' ? l.target : l.target.id) === filterReceiver);

                // Scenario 2: Receiver -> Event -> Sender
                const linkFromReceiver = graphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === filterReceiver && (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id);
                const linkToSender = graphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id && (typeof l.target === 'string' ? l.target : l.target.id) === filterSender);

                if ((linkFromSender && linkToReceiver) || (linkFromReceiver && linkToSender)) {
                    visible.add(eventNode.id);
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
        console.log("Applying filter:", relevantEvents);
        visible = new Set(
          Array.from(visible).filter(id => {
            const node = graphData.nodes.find(n => n.id === id);
            if (!node) return false;
            if (node.type === "Event") return relevantEvents.has(node.id);

            // Check if connected to relevant event
            return graphData.links.some(link => {
              const src = typeof link.source === "string" ? link.source : link.source.id;
              const tgt = typeof link.target === "string" ? link.target : link.target.id;
              return (relevantEvents.has(src) && tgt === id) || (relevantEvents.has(tgt) && src === id);
            });
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

      // Apply the static timestamp filter from props *before* considering animation
      let filteredByStaticTime = new Set(visible);
      if (propTimestampFilterStart || propTimestampFilterEnd) {
        filteredByStaticTime = new Set(
          Array.from(filteredByStaticTime).filter(id => {
            const node = graphData.nodes.find(n => n.id === id);
            if (!node || node.type !== "Event" || !node.timestamp) return true;
            const ts = new Date(node.timestamp).getTime();
            const start = propTimestampFilterStart ? new Date(propTimestampFilterStart).getTime() : -Infinity;
            const end = propTimestampFilterEnd ? new Date(propTimestampFilterEnd).getTime() : Infinity;
            return (ts >= start) && (ts <= end);
          })
        );
      }
      visible = filteredByStaticTime;


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

    const notUsed = getVisibleNodeIds();

    const getVisibleNodeIdsForCommunication = (): Set<string> => {
      let visible = new Set<string>();

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        if (filterSender && filterReceiver && filterDepth === 0) {
          visible.add(filterSender);
          visible.add(filterReceiver);

          // Iterate through all links to find communication events between sender and receiver (bidirectional)
          commGraphData.links.forEach(link => {
            const srcId = typeof link.source === "string" ? link.source : link.source.id;
            const tgtId = typeof link.target === "string" ? link.target : link.target.id;

            // Find the event node connected to this link, if any
            const eventNode = commGraphData.nodes.find(n => n.id === srcId && n.type === "Event") ||
                              commGraphData.nodes.find(n => n.id === tgtId && n.type === "Event");
            
            // Check if this is a "Communication" event and it links sender/receiver
            if (eventNode && eventNode.sub_type === "Communication") {
                // Scenario 1: Sender -> Event -> Receiver
                const linkFromSender = commGraphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === filterSender && (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id);
                const linkToReceiver = commGraphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id && (typeof l.target === 'string' ? l.target : l.target.id) === filterReceiver);

                // Scenario 2: Receiver -> Event -> Sender
                const linkFromReceiver = commGraphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === filterReceiver && (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id);
                const linkToSender = commGraphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id && (typeof l.target === 'string' ? l.target : l.target.id) === filterSender);

                if ((linkFromSender && linkToReceiver) || (linkFromReceiver && linkToSender)) {
                    visible.add(eventNode.id);
                }
            }
          });

        } else {
          while (queue.length > 0 && level <= filterDepth) {
            const nextQueue: string[] = [];
            for (const id of queue) {
              if (visible.has(id)) continue;
              visible.add(id);
              const neighbors = commGraphData.links.flatMap(link => {
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
        commGraphData.nodes.forEach(n => visible.add(n.id));
      }



      if (filterContent.trim()) {
        console.log("Applying filter:", relevantEvents);
        visible = new Set(
          Array.from(visible).filter(id => {
            const node = commGraphData.nodes.find(n => n.id === id);
            if (!node) return false;
            if (node.type === "Event") return relevantEvents.has(node.id); // logik um zu gocken ob event in set - wenn, dann return aggr event id, notevent id
//-----------------------------------------------------------------------------------------------------------------------------------------
            // Check if connected to relevant event
            return commGraphData.links.some(link => { // Logik um ursprüngliche event_id zu holen
              const src = typeof link.source === "string" ? link.source : link.source.id;
              const tgt = typeof link.target === "string" ? link.target : link.target.id;
              return (relevantEvents.has(src) && tgt === id) || (relevantEvents.has(tgt) && src === id);
            });
          })
        );
      }

      // iteriere durhc nods, itereier durch timessampt
      // Apply the static timestamp filter from props *before* considering animation
      let filteredByStaticTime = new Set(visible);
      if (propTimestampFilterStart || propTimestampFilterEnd) {
        filteredByStaticTime = new Set(
          Array.from(filteredByStaticTime).filter(id => {
            const node = commGraphData.nodes.find(n => n.id === id);
            if (!node || node.type !== "Event" || !node.timestamp) return true;
            const ts = new Date(node.timestamp).getTime();
            const start = propTimestampFilterStart ? new Date(propTimestampFilterStart).getTime() : -Infinity;
            const end = propTimestampFilterEnd ? new Date(propTimestampFilterEnd).getTime() : Infinity;
            return (ts >= start) && (ts <= end);
          })
        );
      }
      visible = filteredByStaticTime;

      return visible;
    };
    const visibleIds = getVisibleNodeIdsForCommunication();


    // Create a mutable copy of nodes to allow D3 to set x/y
    let nodesToRender: GraphNode[] = commGraphData.nodes
        .filter(d => visibleIds.has(d.id))
        .map(d => ({ ...d })); // Deep copy to ensure D3 can modify x, y

    let linksToRender: GraphLink[] = commGraphData.links.filter(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      const isVisible = visibleIds.has(src) && visibleIds.has(tgt);

      if (!isVisible) return false;

      //Kommt warhscheinlich weg - 
      // Link visibility also depends on the static time filter
      if (link.timestamp) {
        const ts = new Date(link.timestamp).getTime();
        const start = propTimestampFilterStart ? new Date(propTimestampFilterStart).getTime() : -Infinity;
        const end = propTimestampFilterEnd ? new Date(propTimestampFilterEnd).getTime() : Infinity;
        if (!(ts >= start && ts <= end)) {
          return false;
        }
      }
      return true;
    }).map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      timestamp: link.timestamp,
      value: link.value || 1
    }
  ));

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

      const link = g.append("g")
        .selectAll("line")
        .data(linksToRender)
        .enter().append("line")
        .attr("stroke", d => d.type === "COMMUNICATION" ? "#2ca02c" : d.type === "EVIDENCE_FOR" ? "#800080" : "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1)
        //.attr("marker-end", "url(#arrow)") // Uncomment if you want to use arrow markers
        .on("click", (event: any, d: any) => setSelectedInfo({ type: "link", data: d }));

      const linkFlow = g.append("g")
        .selectAll("polygon")
        .data(linksToRender)
        .enter().append("polygon")
        .attr("points", "-7,-5 8,0 -7,5") // triangle shape, pointing right
        .attr("fill", (d: any) => d.type === "COMMUNICATION" ? "#2ca02c" : d.type === "EVIDENCE_FOR" ? "#800080" : "#999")
        .attr("opacity", 0.9);

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
            node.x = width / 2;
            node.y = height / 2;
        }
      });
      // Update links to use the fixed positions of visible nodes
      linksToRender.forEach(link => {
        const sourceNode = nodesToRender.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodesToRender.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));

        if (sourceNode && targetNode) {
          link.source = sourceNode;
          link.target = targetNode;
        } else {
            link.source = { x: 0, y: 0 } as GraphNode;
            link.target = { x: 0, y: 0 } as GraphNode;
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

      const linkFlow = g.append("g")
        .selectAll("polygon")
        .data(linksToRender)
        .enter().append("polygon")
        .attr("points", "-7,-5 8,0 -7,5") // triangle shape, pointing right
        .attr("fill", (d: any) => d.type === "COMMUNICATION" ? "#2ca02c" : d.type === "EVIDENCE_FOR" ? "#800080" : "#999")
        .attr("opacity", 0.9);

    // Drawing the nodes
    const node = g.selectAll<SVGGElement, GraphNode>(".node-group")
      .data(nodesToRender, d => d.id)
      .join(
        enter => {
          const group = enter.append("g")
            .attr("class", "node-group")
            .on("mouseover", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
            .on("mouseout", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
            .on("click", (event: any, d: any) => {
              setSelectedInfo({ type: "node", data: d });
              if (d.type === "Entity") 
              {
                setFilterSender(d.id);
              // Count muss angepasst werden - sollte momentan nur 1 rauskjommen
              let incomingComm = 0;
              let outgoingComm = 0;
              commGraphData.links.forEach((link: any) => {
                const src = typeof link.source === "string" ? link.source : link.source.id;
                const tgt = typeof link.target === "string" ? link.target : link.target.id;
                if (tgt === d.id) 
                {
                  const srcNode = commGraphData.nodes.find((n: any) => n.id === src && n.type === "Event");
                  if (srcNode) incomingComm++;
                }
                if (src === d.id) 
                {
                  const tgtNode = commGraphData.nodes.find((n: any) => n.id === tgt && n.type === "Event");
                  if (tgtNode) outgoingComm++;
                }
              });
              setSelectedInfo({ type: "node", data: { ...d, incomingCommunicationCount: incomingComm, outgoingCommunicationCount: outgoingComm } });
            } else 
            {
              setSelectedInfo({ type: "node", data: d });
            }
            });

          group.append("circle")
                  .attr("r", (d: any) => {
                    if (d.type === "Entity") return getEntityRadius(d.id);
                    // CommunicationAggregate immer Standardgröße
                    if (d.type === "CommunicationAggregate") return DEFAULT_RADIUS;
                    return DEFAULT_RADIUS;
                  })
                  .attr("fill", (d: any) =>
                    d.type === "Entity" ? "#1f77b4" :
                      d.type === "Event" ? "#2ca02c" :
                        d.type === "Communication" ? "#2ca02c" :
                          d.type === "Relationship" ? "#d62728" :
                            d.id === highlightedMessageId ? "#ff00ff" : "#999"
                  );

          group.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("fill", "black")
            .text(d => d.type === "Entity" ? d.id : d.label)
            .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.label)?.length || 0 - 10))}px`);

          // --- Animation ---
          let animationFrameId: number;
              function animateFlowDots() {
                linkFlow.each(function (d: any, i: number) {
                  const source = d.source as any;
                  const target = d.target as any;
                  if (!source || !target) return;
                  const t = ((Date.now() / 3000 + i * 0.2) % 1);
                  const x = source.x + (target.x - source.x) * t;
                  const y = source.y + (target.y - source.y) * t;
                  // Calculate angle for rotation
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                  d3.select(this)
                    .attr("transform", `translate(${x},${y}) rotate(${angle})`);
                });
                animationFrameId = requestAnimationFrame(animateFlowDots);
              }
              animateFlowDots();
          return group;
        },
        update => {
          
          update
            .on("mouseover", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
            .on("mouseout", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
            .on("click", (event, d) => {
              setSelectedInfo({ type: "node", data: d });
              if (d.type === "Entity") {
                setFilterSender(d.id);
              }
            });

          // Update attributes for the circle and text within the node group
          // Animation highlight logic
          update.select("circle")
            .attr("fill", d => d.type === "Entity" ? "#999" : d.sub_type === "Communication" ? "#1f77b4" : d.type === "Event" ? "#2ca02c" : "#999")
            .attr("stroke", (d) => { // Highlight active event nodes
                if (d.type === "Event" && d.timestamp) {
                    const eventTime = new Date(d.timestamp).getTime();
                    const animationWindowEnd = currentAnimationTime + stepMS; // End of current step window
                    if (eventTime >= currentAnimationTime && eventTime < animationWindowEnd) {
                      // ANimation passend zu nodes in momeentanen frame
                        return "red"; // Highlight color
                    }
                }
                return "none";
            })
            .attr("stroke-width", (d) => {
                if (d.type === "Event" && d.timestamp) {
                    const eventTime = new Date(d.timestamp).getTime();
                    const animationWindowEnd = currentAnimationTime + stepMS;
                    if (eventTime >= currentAnimationTime && eventTime < animationWindowEnd) {
                        return 3; // Highlight thickness
                    }
                }
                return 0;
            });

          update.select("text")
            .text(d => d.type === "Entity" ? d.id : d.label)
            .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.label)?.length || 0 - 10))}px`);

          return update;
        },
        exit => exit.remove()
      );

    // Manually update positions for both links and nodes if simulation is not running
    g.selectAll<SVGGElement, GraphNode>(".node-group").raise();
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
    relevantEvents,
    propTimestampFilterStart,
    propTimestampFilterEnd,
    filterMode,
    nodePositions,
    currentAnimationTime,
    stepMS,
    setSelectedInfo,
    setFilterSender,
    commGraphData
  ]);

  return (
    <>
      {controls}
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
      <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 10, background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        {/* LegendPanel unten rechts im GraphView-Panel */}
        <LegendPanel />
      </div>
    </div>
    </>
  );
};

export default GraphView;