'use client';
import { GraphData, Node, Link, Props } from '../types';
import { getVisibleNodeIds } from './getVisibleNodeIds';
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";


export default function GraphView({
  graphData,
  filterEntityId,
  filterDepth,
  filterContent,
  selectedTimestamp,
  filterMode,
  setSelectedInfo,
  setVisibleEntities,
  setSubtypeCounts,
  setEdgeTypeCounts,
  setEdgeCount,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !graphContainerRef.current) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const width = graphContainerRef.current.clientWidth;
    const height = 500;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform)));


    const visibleIds = getVisibleNodeIds(graphData, filterEntityId, filterDepth, filterContent, selectedTimestamp);

    
    const nodes = graphData.nodes.filter(d => visibleIds.has(d.id) &&
      (d.type === "Entity" || filterMode === "all" || (filterMode === "event" && d.type === "Event") || (filterMode === "relationship" && d.type === "Relationship")));
    const visibleEntityList = nodes.filter(d => d.type === "Entity").map(d => ({ id: d.id, sub_type: d.label }));
    setVisibleEntities(visibleEntityList);

    console.log("Graph data nodes:", graphData.nodes.length);
    console.log("Graph data links:", graphData.links.length);


    const links = graphData.links.filter(link => visibleIds.has(typeof link.source === "string" ? link.source : link.source.id) &&
      visibleIds.has(typeof link.target === "string" ? link.target : link.target.id))
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
        if (d.type?.match(/AccessPermission|Operates|Colleagues|Suspicious|Reports|Jurisdiction|Unfriendly|Friends/)) return "brown";
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
      .call(d3.drag()
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
  }, [graphData, filterEntityId, filterDepth, filterContent, selectedTimestamp, filterMode]);

  return <svg ref={svgRef} className="w-full h-full" />;
}
