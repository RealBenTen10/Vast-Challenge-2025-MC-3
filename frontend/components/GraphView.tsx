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
  setCommunicationEventsAfterTimeFilter: (eventIds: string[]) => void;
  setEventsAfterTimeFilter: (nodes: GraphNode[]) => void;
  communicationEventsAfterTimeFilter: string[];
  callApi: (endpoint: string) => void;
  relevantEvents: Set<string>;
  setrelevantEvents: (events: Set<string>) => void;
  filterEntityId: string;
  selectedTimestamp: string | null;
  highlightedMessageId?: string | null;
  graphHeight: number;
  commGraphData: GraphDataModified;
  setSelectedEventId: (id: string) => void;
  setResetFilterPushed: (v: boolean) => void;
  resetFilterPushed: boolean;
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
  commGraphData,
  setSelectedEventId,
  setResetFilterPushed,
  resetFilterPushed
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInAnimation, setIsInAnimation] = useState(false);
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

  const EVENT_COLOR_MAP: Record<string, string> = {
    Monitoring: "#1f77b4",        // blue
    Assessment: "#ff7f0e",        // orange
    VesselMovement: "#2ca02c",    // green
    Enforcement: "#d62728",       // red
    TourActivity: "#9467bd",      // violet
    Collaborate: "#8c564b",       // brown
    TransponderPing: "#17becf",   // turquoise
    HarborReport: "#bcbd22",      // yellow
    Criticize: "#e377c2",         // pink
    Unknown: "#999999"            // grey
  };


  const getEntityRadius = (id: string) => {
      // Zähle alle CommunicationAggregate-Nodes, die mit dieser Entity verbunden sind
      let commCount = 0;
      graphData.links.forEach((link: any) => {
        const src = typeof link.source === "string" ? link.source : link.source.id;
        const tgt = typeof link.target === "string" ? link.target : link.target.id;
        // Prüfe, ob die Entity beteiligt ist und die andere Seite ein CommunicationAggregate ist
        if (src === id) {
          const tgtNode = graphData.nodes.find((n: any) => n.id === tgt && n.sub_type === "Communication");
          if (tgtNode) commCount++;
        }
        if (tgt === id) {
          const srcNode = graphData.nodes.find((n: any) => n.id === src && n.sub_type === "Communication");
          if (srcNode) commCount++;
        }
      });
      console.log(`Entity ${id} has ${commCount} CommunicationAggregate connections.`);
      return DEFAULT_RADIUS + commCount * 0.2;

    };

  useEffect(() => {
    if (resetFilterPushed) {
    setIsPlaying(false); 
    setIsInAnimation(false); 
    setCurrentAnimationTime(animationStartTime);
    setResetFilterPushed(false);
  }
  }, [resetFilterPushed])

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
            setIsInAnimation(false); 
            return animationStartTime; // Loop back to start
          }
          return nextTime;
        });
      }, 1500); // Animation update rate (adjust as needed)
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
    setIsInAnimation(true)
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
      <button onClick={() => { setIsPlaying(true); setIsInAnimation(true)}}>▶ Play</button>
      <button onClick={() => setIsPlaying(false)}>⏸ Pause</button>
      <button onClick={() => { setIsPlaying(false); setIsInAnimation(false); setCurrentAnimationTime(animationStartTime); }}>⏹ Stop</button>
      <button onClick={() => handleStep('backward')}>◀ Step Back</button>
      <button onClick={() => handleStep('forward')}>Step ▶</button>
      <select value={stepMS / 60000} onChange={e => setStepMS(+e.target.value * 60000)}>
        <option value={1}>1 min</option>
        <option value={5}>5 min</option>
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={60}>1 h</option>
        <option value={3 * 60}>3 h</option>
        <option value={6 * 60}>6 h</option>
        <option value={12 * 60}>12 h</option>
        <option value={24 * 60}>1 day</option>
      </select>
      
      {isPlaying || isInAnimation ? (
        <div className="mt-2">
          <strong>Currently showing animation for:</strong>{" "}
          {new Date(currentAnimationTime).toLocaleString()} <strong>–</strong>{" "}
          {new Date(currentAnimationTime + stepMS).toLocaleString()}
        </div>
      ) : (
        <div className="mt-1 text-sm text-gray-700">
          Showing Communications from{" "}
          <span className="font-semibold">{new Date(animationStartTime).toLocaleString()}</span>{" "}
          to{" "}
          <span className="font-semibold">{new Date(animationEndTime).toLocaleString()}</span>
        </div>
      )}

      {!isPlaying && !isInAnimation && (
        <div className="text-sm mt-1">Press Play to start animation</div>
      )}
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

    svg.select("defs").remove();


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

    if (!isPlaying || !isInAnimation) {
    const getVisibleNodeIds = (): Set<string> => {
      let visible1 = new Set<string>();

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        if (filterSender && filterReceiver && filterDepth === 0) {
          visible1.add(filterSender);
          visible1.add(filterReceiver);

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
                    visible1.add(eventNode.id);
                }
            }
          });

        } else {
          while (queue.length > 0 && level <= filterDepth) {
            const nextQueue: string[] = [];
            for (const id of queue) {
              if (visible1.has(id)) continue;
              visible1.add(id);
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
        // 🔽 Add non-communication events connected to two visible entities
        graphData.nodes.forEach(node => {
          if (
            node.type === "Event" &&
            node.sub_type !== "Communication" &&
            !visible1.has(node.id)
          ) {
            // Find all neighboring node IDs
            const connectedEntities = graphData.links
              .filter(link => {
                const srcId = typeof link.source === "string" ? link.source : link.source.id;
                const tgtId = typeof link.target === "string" ? link.target : link.target.id;
                return srcId === node.id || tgtId === node.id;
              })
              .map(link => {
                const srcId = typeof link.source === "string" ? link.source : link.source.id;
                const tgtId = typeof link.target === "string" ? link.target : link.target.id;
                return srcId === node.id ? tgtId : srcId;
              })
              .filter(id => visible1.has(id));

            // Add only if at least two visible neighbors
            if (connectedEntities.length >= 2) {
              visible1.add(node.id);
            }
          }
        });
      } else {
        graphData.nodes.forEach(n => visible1.add(n.id));
      }

      if (filterContent.trim()) {
        console.log("Applying filter:", relevantEvents);
        visible1 = new Set(
          Array.from(visible1).filter(id => {
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


      const visibleSetBeforeTimeFilter = new Set(visible1);
      setCommunicationEvents(
        graphData.nodes.filter(n =>
          n.type === "Event" &&
          n.sub_type === "Communication" &&
          visibleSetBeforeTimeFilter.has(n.id)
        )
      );

      // Apply the static timestamp filter from props *before* considering animation
      let filteredByStaticTime = new Set(visible1);
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
      visible1 = filteredByStaticTime;


      const visibleSetAfterTimeFilter = new Set(visible1);
        setCommunicationEventsAfterTimeFilter(
          graphData.nodes
            .filter(
              (n) =>
                n.type === "Event" &&
                n.sub_type === "Communication" &&
                visibleSetAfterTimeFilter.has(n.id)
            )
            .map((n) => n.id) // extract only the IDs rest is fetched in CommView
        );


      const filteredEvents = graphData.nodes.filter(n =>
        n.type === "Event" &&
        n.sub_type !== "Communication" &&
        visibleSetAfterTimeFilter.has(n.id)
      );
      const uniqueEvents = Array.from(new Map(filteredEvents.map(e => [e.id, e])).values());

      setEventsAfterTimeFilter(uniqueEvents);


      return visible1;
    };
    const notUsed = getVisibleNodeIds();
    console.log("NotUsed: ", notUsed)
  }
    
    

    const getVisibleNodeIdsForCommunication = (): Set<string> => {
      let visible = new Set<string>();
      const filterEntities = [filterSender, filterReceiver].filter(Boolean);

      // Step 1: Entity-based filtering
      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;

        if (filterSender && filterReceiver && filterDepth === 0) {
          visible.add(filterSender);
          visible.add(filterReceiver);

          // Match communication events linking sender and receiver
          commGraphData.links.forEach(link => {
            const srcId = typeof link.source === "string" ? link.source : link.source.id;
            const tgtId = typeof link.target === "string" ? link.target : link.target.id;

            const eventNode = commGraphData.nodes.find(n => n.id === srcId && n.type === "Event") ||
                              commGraphData.nodes.find(n => n.id === tgtId && n.type === "Event");

            if (eventNode && eventNode.sub_type === "Communication") {
              const linkFromSender = commGraphData.links.some(l =>
                (typeof l.source === 'string' ? l.source : l.source.id) === filterSender &&
                (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id
              );
              const linkToReceiver = commGraphData.links.some(l =>
                (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id &&
                (typeof l.target === 'string' ? l.target : l.target.id) === filterReceiver
              );
              const linkFromReceiver = commGraphData.links.some(l =>
                (typeof l.source === 'string' ? l.source : l.source.id) === filterReceiver &&
                (typeof l.target === 'string' ? l.target : l.target.id) === eventNode.id
              );
              const linkToSender = commGraphData.links.some(l =>
                (typeof l.source === 'string' ? l.source : l.source.id) === eventNode.id &&
                (typeof l.target === 'string' ? l.target : l.target.id) === filterSender
              );

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
        // 🔽 Add non-communication events connected to two visible entities
        commGraphData.nodes.forEach(node => {
          if (
            node.type === "Event" &&
            node.sub_type !== "Communication" &&
            !visible.has(node.id)
          ) {
            // Find all neighboring node IDs
            const connectedEntities = commGraphData.links
              .filter(link => {
                const srcId = typeof link.source === "string" ? link.source : link.source.id;
                const tgtId = typeof link.target === "string" ? link.target : link.target.id;
                return srcId === node.id || tgtId === node.id;
              })
              .map(link => {
                const srcId = typeof link.source === "string" ? link.source : link.source.id;
                const tgtId = typeof link.target === "string" ? link.target : link.target.id;
                return srcId === node.id ? tgtId : srcId;
              })
              .filter(id => visible.has(id));

            // Add only if at least two visible neighbors
            if (connectedEntities.length >= 2) {
              visible.add(node.id);
            }
          }
        });

      } else {
        // No entity filter → include all nodes
        commGraphData.nodes.forEach(n => visible.add(n.id));
      }

      // Step 2: Content similarity filter (relevantEvents are original event_ids)
      if (filterContent.trim()) {
        console.log("Applying filter:", relevantEvents);
        visible = new Set(
          Array.from(visible).filter(id => {
            const node = commGraphData.nodes.find(n => n.id === id);
            if (!node) return false;

            // For communication events: check if any of the original event_ids are relevant
            if (node.type === "Event" && Array.isArray(node.event_ids)) {
              return node.event_ids.some(eid => relevantEvents.has(eid));
            }

            // For other nodes: check if connected to a relevant communication event
            return commGraphData.links.some(link => {
              const src = typeof link.source === "string" ? link.source : link.source.id;
              const tgt = typeof link.target === "string" ? link.target : link.target.id;
              return (relevantEvents.has(src) && tgt === id) || (relevantEvents.has(tgt) && src === id);
            });
          })
        );
      }

      // Step 3: Static timestamp filtering (filtering using any timestamp in the node's "timestamps" array)
      if (propTimestampFilterStart || propTimestampFilterEnd) {
        const start = propTimestampFilterStart ? new Date(propTimestampFilterStart).getTime() : -Infinity;
        const end = propTimestampFilterEnd ? new Date(propTimestampFilterEnd).getTime() : Infinity;

        visible = new Set(
          Array.from(visible).filter(id => {
            const node = commGraphData.nodes.find(n => n.id === id);
            if (!node || node.type !== "Event") return true;

            const timestamps: string[] =
              Array.isArray(node.timestamps) ? node.timestamps :
              typeof node.timestamp === "string" ? [node.timestamp] :
              [];

            // Keep the node if any of its timestamps fall in the range
            return timestamps.some(ts => {
              const t = new Date(ts).getTime();
              return t >= start && t <= end;
            });
          })
        );
      }

      return visible;
    };

    const visibleIds = getVisibleNodeIdsForCommunication();
    console.log("VisibleIds: ", visibleIds)


    // Create a mutable copy of nodes to allow D3 to set x/y
    let nodesToRender: GraphNode[] = commGraphData.nodes
        .filter(d => visibleIds.has(d.id))
        .map(d => ({ ...d })); // Deep copy to ensure D3 can modify x, y
    console.log("Nodes to render: ", nodesToRender)

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
    });

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
        .on("click", (event: any, d: any) => setSelectedInfo({ type: "link", data: d }));

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
            const sourceNode = typeof d.source === "object" ? d.source : commGraphData.nodes.find(n => n.id === d.source);
            const targetNode = typeof d.target === "object" ? d.target : commGraphData.nodes.find(n => n.id === d.target);

            
            if (sourceNode?.sub_type === "Communication" || targetNode?.sub_type === "Communication") {
              return "#1f77b4"; 
            }
            if (sourceNode?.type === "Event") {
              return EVENT_COLOR_MAP[sourceNode.sub_type ?? "Unknown"] || "#999";
            }
            if (targetNode?.type === "Event") {
              return EVENT_COLOR_MAP[targetNode.sub_type ?? "Unknown"] || "#999";
            }
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
              }
            );
              setSelectedInfo({ type: "node", data: { ...d, incomingCommunicationCount: incomingComm, outgoingCommunicationCount: outgoingComm } });
            } else 
            {
              setSelectedInfo({ type: "node", data: d });
            }
            });

          group.append("circle")
                  .attr("r", (d: any) => {
                    if (d.type === "Entity") return getEntityRadius(d.id);
                    if (d.type === "Event" && d.sub_type === "Communication") {
                      const baseSize = DEFAULT_RADIUS;
                      const count = d.count;
                      return baseSize + count;  // Maybe stärker steigen lassen und dafür logarithmisch amchen
                    }
                    return DEFAULT_RADIUS;
                  })
                  .attr("fill", (d: any) =>
                    d.type === "Entity" ? "#999" :
                      d.sub_type === "Communication" ? "#1f77b4" :
                        d.type === "Event" ? "#ff7f0e" :
                          d.type === "Relationship" ? "#d62728" :
                            d.id === highlightedMessageId ? "#ff00ff" : "#999"
                  );

          group.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("fill", "black")
            .text(d => d.type === "Entity" ? d.id : d.sub_type)
            .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.sub_type)?.length || 0 - 10))}px`);
            
          return group;
        },
  // Mouse interaction handlers
  update => {
  // === Interaction handlers ===
  update
    .on("mouseover", (event, d) =>
      d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4)
    )
    .on("mouseout", (event, d) =>
      d3.select(event.currentTarget).select("circle").attr("stroke", "none")
    )
    .on("click", (event, d) => {
      setSelectedInfo({ type: "node", data: d });
      if (d.type === "Entity") {
        setFilterSender(d.id);
      }
      // Get glicked Event for EventView and CommView (Evidence_for)
      if (d.type === "Event" && d.sub_type !== "Communication") {
        setSelectedEventId(d.id);
      }
    });

  // === Precompute active events and links for use in both branches ===
  const animationWindowEnd = currentAnimationTime + stepMS;

  const isActiveEvent = (d) => {
    if (d.type === "Event") {
      if (Array.isArray(d.timestamps)) {
        return d.timestamps.some(ts => {
          const time = new Date(ts).getTime();
          return time >= currentAnimationTime && time < animationWindowEnd;
        });
      } else if (d.timestamp) {
        const eventTime = new Date(d.timestamp).getTime();
        return eventTime >= currentAnimationTime && eventTime < animationWindowEnd;
      }
    }
    return false;
  };
  
  const activeEventIds = new Set(
    nodesToRender
      .filter(d => isActiveEvent(d))
      .map(d => d.id)
  );
  
  if (isPlaying || isInAnimation) {
  const getActiveEventIdsForCommView = (nodes: any[]) => {
    const activeIds = new Set<string>();

    nodes.forEach((d) => {
      if (
        d.sub_type === "Communication" &&
        Array.isArray(d.timestamps) &&
        Array.isArray(d.event_ids)
      ) {
        // Ensure matching lengths to avoid index mismatches
        const minLen = Math.min(d.timestamps.length, d.event_ids.length);

        for (let i = 0; i < minLen; i++) {
          const ts = new Date(d.timestamps[i]).getTime();
          if (ts >= currentAnimationTime && ts < animationWindowEnd) {
            activeIds.add(d.event_ids[i]);
          }
        }
      } else if (
        d.sub_type === "Communication" &&
        d.timestamp &&
        d.id
      ) {
        // Fallback for single timestamp + single id (non-aggregated case)
        const ts = new Date(d.timestamp).getTime();
        if (ts >= currentAnimationTime && ts < animationWindowEnd) {
          activeIds.add(d.id);
        }
      }
    });

    return Array.from(activeIds); // Convert Set<string> to string[]
  };

  const activeEventIdsForCommView = getActiveEventIdsForCommView(nodesToRender);
  setCommunicationEventsAfterTimeFilter(activeEventIdsForCommView);
  console.log("Nodes to render: ", nodesToRender)
  console.log("For Animation: ", activeEventIdsForCommView)
  }

  const isActiveLink = (l) => {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    return activeEventIds.has(src) || activeEventIds.has(tgt);
  };
 // Identify entities connected to active events via links
  const connectedEntities = new Set();

  linksToRender.forEach(link => {
    if (isActiveLink(link)) {
      // Extract source and target node ids
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      // If source or target is an Entity, add to connectedEntities set
      const srcNode = nodesToRender.find(n => n.id === src);
      const tgtNode = nodesToRender.find(n => n.id === tgt);

      if (srcNode?.type === "Entity") connectedEntities.add(src);
      if (tgtNode?.type === "Entity") connectedEntities.add(tgt);
    }
  });
  // === Visuals for animated or normal state ===
  // === Visuals for animated or normal state ===
    if (isPlaying || isInAnimation) {
      update.select("circle")
        .attr("fill", d =>
          d.type === "Entity"
            ? "#999"
            : d.sub_type === "Communication"
            ? "#1f77b4"
            : d.type === "Event"
            ? "#ff7f0e"
            : "#999"
        )
        //.attr("stroke", d => (isActiveEvent(d) ? "red" : "none")) // Do we still need this?
        .attr("stroke-width", d => (isActiveEvent(d) ? 3 : 0))
        .attr("opacity", d => {
          if (d.type === "Event") {
            return isActiveEvent(d) ? 1 : 0.15;
          }
          if (d.type === "Entity") {
            // Dim entity if not connected to any active event
            return connectedEntities.has(d.id) ? 1 : 0.2;
          }
          return 1;
        });

      d3.select(svgRef.current)
        .selectAll("line")
        .attr("opacity", d => (isActiveLink(d) ? 1 : 0.1));

      // Polygons (link-arrow) opacity for animation state
      d3.select(svgRef.current).selectAll("polygon.link-arrow")
        .attr("opacity", (d: any) => (isActiveLink(d) ? 1 : 0.25)); // This line was missing for the polygon update
    } else {
      // This block executes when animation is NOT playing
      update.select("circle")
        .attr("fill", d =>
          d.type === "Entity"
            ? "#999"
            : d.sub_type === "Communication"
            ? "#1f77b4"
            : d.type === "Event"
            ? "#ff7f0e"
            : "#999"
        )
        .attr("stroke", "none")
        .attr("stroke-width", 0)
        .attr("opacity", 1); // Ensure circles are fully opaque

      d3.select(svgRef.current)
        .selectAll("line")
        .attr("opacity", 1); // Ensure lines are fully opaque

      // 👇 ADD THIS LINE for polygons when no animation is playing
      d3.select(svgRef.current)
        .selectAll("polygon.link-arrow")
        .attr("opacity", 1); // Ensure polygons are fully opaque
    }

      // === Render directional arrows (linkFlow) ===
      const g = d3.select(svgRef.current).select("g");

      const linkFlow = g.selectAll("polygon.link-arrow")
        .data(linksToRender, (d: any) => `${d.source.id}-${d.target.id}`);

      linkFlow.exit().remove();

      linkFlow.enter()
        .append("polygon")
        .attr("class", "link-arrow")
        .attr("points", "-7,-5 8,0 -7,5")
        .merge(linkFlow as any)
        .each(function(d: any) {
          console.log("Polygon datum:", d);
        })
        .attr("fill", (d: any) =>
          d.type === "COMMUNICATION" ? "#2ca02c" :
          d.type === "EVIDENCE_FOR" ? "#800080" :
          "#999"
        )
        .attr("transform", (d: any) => {
          const source = typeof d.source === "object" ? d.source : nodePositions[d.source];
          const target = typeof d.target === "object" ? d.target : nodePositions[d.target];

          const ratio = 0.25;
          const arrowX = source.x + (target.x - source.x) * ratio;
          const arrowY = source.y + (target.y - source.y) * ratio;
          const angle = Math.atan2(target.y - source.y, target.x - source.x) * (180 / Math.PI);
          return `translate(${arrowX},${arrowY}) rotate(${angle})`;
        });


      // === Labels ===
      update.select("text")
        .text(d => (d.type === "Entity" ? d.id : d.sub_type))
        .style("font-size", d =>
          `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.sub_type)?.length || 0 - 10))}px`
        );

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