import React, { useEffect } from "react";
import * as d3 from "d3";
import { GraphData, Node, Link } from "@/components/types";

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
  setSelectedInfo
}) => {
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

    const nodes = graphData.nodes.filter(d =>
      visibleIds.has(d.id) &&
      (d.type === "Entity" || filterMode === "all" || (filterMode === "event" && d.type === "Event") || (filterMode === "relationship" && d.type === "Relationship"))
    );

    setVisibleEntities(nodes.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label })));

    const links = graphData.links.filter(link =>
      visibleIds.has(typeof link.source === "string" ? link.source : link.source.id) &&
      visibleIds.has(typeof link.target === "string" ? link.target : link.target.id)
    ).map(link => ({
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
      .on("click", (event, d) => setSelectedInfo({ type: "link", data: d }));

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag()
        .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("mouseover", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "purple").attr("stroke-width", 4))
      .on("mouseout", (event, d) => d3.select(event.currentTarget).select("circle").attr("stroke", "none"))
      .on("click", (event, d) => setSelectedInfo({ type: "node", data: d }));

    node.append("circle")
      .attr("r", 20)
      .attr("fill", d => d.type === "Entity" ? "#1f77b4" : d.type === "Event" ? "#2ca02c" : d.type === "Relationship" ? "#d62728" : "#999");

    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "black")
      .text(d => d.type === "Entity" ? d.id : d.label)
      .style("font-size", d => `${Math.max(8, 12 - ((d.type === "Entity" ? d.id : d.label)?.length - 10))}px`);

    simulation.on("tick", () => {
      link.attr("x1", d => (d.source as any).x)
          .attr("y1", d => (d.source as any).y)
          .attr("x2", d => (d.target as any).x)
          .attr("y2", d => (d.target as any).y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
  }, [graphData, filterEntityId, filterDepth, filterContent, selectedTimestamp, filterMode]);

  return null;
};

export default GraphView;
