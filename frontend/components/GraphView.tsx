"use client";

import React, { useEffect } from "react";
import * as d3 from "d3";
import { GraphData } from "@/components/types";

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
  callApi
}) => {
  useEffect(() => {
    callApi("/read-db-graph"); // Load full graph once
  }, []);

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

      const filterEntities = [filterSender, filterReceiver].filter(Boolean);
      if (filterEntities.length > 0) {
        const queue = [...filterEntities];
        let level = 0;
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
      } else {
        graphData.nodes.forEach(n => visible.add(n.id));
      }

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

    const visibleIds = getVisibleNodeIds();

    const nodes = graphData.nodes.filter(d =>
      visibleIds.has(d.id) &&
      (d.type === "Entity" || filterMode === "all" || (filterMode === "event" && d.type === "Event") || (filterMode === "relationship" && d.type === "Relationship"))
    );

    setVisibleEntities(nodes.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label })));

    const links = graphData.links.filter(link => {
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
      .attr("stroke", d => {
        if (d.type === "COMMUNICATION") return "#2ca02c";
        if (d.type === "EVIDENCE_FOR") return "#800080";
        return "#999";
      })
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
      .on("click", (event, d) => {
        setSelectedInfo({ type: "node", data: d });
        if (d.type === "Entity") {
          setFilterSender(d.id); 
        }
      });

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
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
  }, [
    graphData,
    filterSender,
    filterReceiver,
    filterDepth,
    filterContent,
    timestampFilterStart,
    timestampFilterEnd,
    filterMode,
  ]);

  return null;
};

export default GraphView;
