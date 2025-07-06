import React, { useEffect } from "react";
import * as d3 from "d3";
import { GraphData, Node, Link } from "@/components/types";
import LegendPanel from "./LegendPanel"; // Importiere das LegendPanel

interface Props {
  graphData: GraphData;
  svgRef: React.RefObject<SVGSVGElement>;
  graphContainerRef: React.RefObject<HTMLDivElement>;
  filterEntityId: string;
  filterDepth: number;
  filterContent: string;
  filterMode: string;
  selectedTimestamp: string | null;
  setVisibleEntities: (entities: { id: string; sub_type?: string }[]) => void;
  setSubtypeCounts: (counts: Record<string, number>) => void;
  setEdgeTypeCounts: (counts: Record<string, number>) => void;
  setEdgeCount: (count: number) => void;
  setSelectedInfo: (info: any) => void;
  highlightedMessageId?: string | null;
  graphHeight: number;
}

const GraphView: React.FC<Props> = ({
  graphData,
  svgRef,
  graphContainerRef,
  filterEntityId,
  filterDepth,
  filterContent,
  filterMode,
  selectedTimestamp,
  setVisibleEntities,
  setSubtypeCounts,
  setEdgeTypeCounts,
  setEdgeCount,
  setSelectedInfo,
  highlightedMessageId,
  graphHeight
}) => {

  const DEFAULT_RADIUS = 20;
  const HIGHLIGHT_RADIUS = 30;


  // 1. Nur Daten/Filter triggern kompletten Neuaufbau
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current || graphData.nodes.length === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const width = graphContainerRef.current.clientWidth;
    //--------------------------------------------------------------------- // NP
    const height = graphHeight || 500;
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
//--------------------------------------------------------------------- // NP
    svg.append("defs").append("marker") 
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25) // → Wird gleich dynamisch angepasst
      .attr("refY", 0)
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("markerUnits", "userSpaceOnUse") // ← wichtig für absolute Koordinaten
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");


//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    const g = svg.append("g");

    svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform)));

    const getVisibleNodeIds = (): Set<string> => {
      let visible = new Set<string>();
      if (filterEntityId) {
        const queue = [filterEntityId];
        let level = 0;
        while (queue.length > 0 && level <= filterDepth) {
          const nextQueue: string[] = [];
          for (const id of queue) {
            if (visible.has(id)) continue;
            visible.add(id);
            const neighbors = graphData.links.filter(link => {
              const src = typeof link.source === "string" ? link.source : link.source.id;
              const tgt = typeof link.target === "string" ? link.target : link.target.id;
              return src === id || tgt === id;
            }).map(link => {
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
        graphData.nodes.forEach(n => visible.add(n.id));
      }

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

      if (selectedTimestamp?.trim()) {
        visible = new Set(
          Array.from(visible).filter(id => {
            const node = graphData.nodes.find(n => n.id === id);
            if (!node) return false;
            if (node.type === "Event") return node.timestamp?.startsWith(selectedTimestamp);
            return true;
          })
        );
      }

      return visible;
    };

    const visibleIds = getVisibleNodeIds();

    const communicationCounts: Record<string, number> = {};
    graphData.links.forEach(link => {
      if (link.type === "COMMUNICATION") {
        const src = typeof link.source === "string" ? link.source : link.source.id;
        // Prüfen, ob src eine Entity ist
        const srcNode = graphData.nodes.find(n => n.id === src && n.type === "Entity");
        if (srcNode) {
          communicationCounts[src] = (communicationCounts[src] || 0) + 1;
        }
      }
    });
//-------------------------------------------------------------------- // NP MUSS ABER ANGEPASST WERDEN - muss 2 Mal übernommen werden: vor und nach fs
    // Entity-Radius anhand der Anzahl anliegender CommunicationAggregate-Nodes (in+out)
    const getEntityRadius = (id: string) => {
      // Zähle alle CommunicationAggregate-Nodes, die mit dieser Entity verbunden sind
      let commCount = 0;
      graphData.links.forEach((link: any) => {
        const src = typeof link.source === "string" ? link.source : link.source.id;
        const tgt = typeof link.target === "string" ? link.target : link.target.id;
        // Prüfe, ob die Entity beteiligt ist und die andere Seite ein CommunicationAggregate ist
        if (src === id) {
          const tgtNode = graphData.nodes.find((n: any) => n.id === tgt && n.type === "CommunicationAggregate");
          if (tgtNode) commCount++;
        }
        if (tgt === id) {
          const srcNode = graphData.nodes.find((n: any) => n.id === src && n.type === "CommunicationAggregate");
          if (srcNode) commCount++;
        }
      });
      return DEFAULT_RADIUS + 2 * (Math.max(1, commCount) - 1);
    };
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
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
      return DEFAULT_RADIUS + 2 * (Math.max(1, commCount) - 1);
    };
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    const nodes = graphData.nodes.filter(d =>
      visibleIds.has(d.id) &&
      (d.type === "Entity" || filterMode === "all" || (filterMode === "event" && d.type === "Event") || (filterMode === "relationship" && d.type === "Relationship"))
    );

    setVisibleEntities(nodes.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label })));

    // Nur Links, deren source UND target im aktuellen nodes-Array existieren
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = graphData.links.filter(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      return nodeIds.has(src) && nodeIds.has(tgt);
    }).map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      timestamp: link.timestamp,
      value: link.value || 1
    }));

    const subtypeCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const subtype = node.sub_type || node.label || "Unknown";
      subtypeCounts[subtype] = (subtypeCounts[subtype] || 0) + 1;
    });
    setSubtypeCounts(subtypeCounts);

    const edgeCounts: Record<string, number> = {};
    links.forEach(link => {
      edgeCounts[link.type] = (edgeCounts[link.type] || 0) + 1;
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
      .attr("stroke", d => d.type === "COMMUNICATION" ? "#2ca02c" : d.type === "EVIDENCE_FOR" ? "#800080" : "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      //.attr("marker-end", "url(#arrow)") // Uncomment if you want to use arrow markers
      .on("click", (event: any, d: any) => setSelectedInfo({ type: "link", data: d }));
//--------------------------------------------------------------------- // NP
    // Add animated triangles for flow visualization
    const linkFlow = g.append("g")
      .selectAll("polygon")
      .data(links)
      .enter().append("polygon")
      .attr("points", "-7,-5 8,0 -7,5") // triangle shape, pointing right
      .attr("fill", (d: any) => d.type === "COMMUNICATION" ? "#2ca02c" : d.type === "EVIDENCE_FOR" ? "#800080" : "#999")
      .attr("opacity", 0.9);
      //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    const node = g.append("g") 
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag()
        .on("start", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("end", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (event: any, d: any) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
      .on("mouseout", (event: any, d: any) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
      //------------------------------------------------------ // Neuen Type machen
      .on("click", (event: any, d: any) => {
        if (d.type === "Entity") {
          // Eingehende und ausgehende CommunicationAggregate-Nodes zählen
          let incomingComm = 0;
          let outgoingComm = 0;
          graphData.links.forEach((link: any) => {
            const src = typeof link.source === "string" ? link.source : link.source.id;
            const tgt = typeof link.target === "string" ? link.target : link.target.id;
            if (tgt === d.id) {
              const srcNode = graphData.nodes.find((n: any) => n.id === src && n.type === "CommunicationAggregate");
              if (srcNode) incomingComm++;
            }
            if (src === d.id) {
              const tgtNode = graphData.nodes.find((n: any) => n.id === tgt && n.type === "CommunicationAggregate");
              if (tgtNode) outgoingComm++;
            }
          });
          setSelectedInfo({ type: "node", data: { ...d, incomingCommunicationCount: incomingComm, outgoingCommunicationCount: outgoingComm } });
        } else {
          setSelectedInfo({ type: "node", data: d });
        }
      });
      //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    node.append("circle")
    //----------------------------------------------------------------------- //group.append(circel) - da rein kopierern)
      .attr("r", (d: any) => {
        if (d.type === "Entity") return getEntityRadius(d.id);
        // CommunicationAggregate immer Standardgröße
        if (d.type === "CommunicationAggregate") return DEFAULT_RADIUS;
        return DEFAULT_RADIUS;
      })
      .attr("fill", (d: any) =>
        d.type === "Entity" ? "#1f77b4" :
          d.type === "Event" ? "#2ca02c" :
            d.type === "CommunicationAggregate" ? "#2ca02c" :
              d.type === "Relationship" ? "#d62728" :
                d.id === highlightedMessageId ? "#ff00ff" : "#999"
      );
//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "black")
      //--------------------------------------------------------------------------------- // group.append("text") dort rein anpassen; ANimation NP, aber maybe 2 mal machen
      .text((d: any) =>
        d.type === "Entity" ? d.id :
          d.type === "CommunicationAggregate" ? "Communication" :
            d.label
      )
      .style("font-size", "12px"); // Einheitliche Schriftgröße für alle Labels

    // --- Animation unabhängig von der Simulation ---
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
    //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => (d.source as any).x)
        .attr("y1", (d: any) => (d.source as any).y)
        .attr("x2", (d: any) => (d.target as any).x)
        .attr("y2", (d: any) => (d.target as any).y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Clean up animation on unmount
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [graphData, filterEntityId, filterDepth, filterContent, selectedTimestamp, filterMode]);
//------------------------------------------------------------------------ // SOllte NP seina ebr mal testen
  // 2. Nur SVG-Größe anpassen, ohne Neuaufbau
  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current) return;
    const width = graphContainerRef.current.clientWidth;
    const height = graphHeight || 500;
    d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
  }, [graphHeight, graphContainerRef]);

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  useEffect(() => {
    console.log("GraphView props:", {
      highlightedMessageId,
      graphData,
      filterEntityId,
      filterDepth,
      filterContent,
      filterMode,
      selectedTimestamp
    });
  }, [highlightedMessageId, graphData, filterEntityId, filterDepth, filterContent, filterMode, selectedTimestamp]);
//------------------------------------------------------------------------ //NP
  // Render SVG and LegendPanel in a relative container
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
      <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 10, background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        {/* LegendPanel unten rechts im GraphView-Panel */}
        <LegendPanel />
      </div>
    </div>
  );
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
};

export default GraphView;
