"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { SankeyGraph, sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";

interface SankeyDataItem {
  source: string;
  target: string;
  value: number;
}

interface SankeyProps {
  entityId: string;
  selectedDate: string | null;
}

export default function Sankey({ entityId, selectedDate }: SankeyProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!entityId) return;

    const fetchDataAndDraw = async () => {
      try {
        const params = new URLSearchParams({ entity_id: entityId });
        if (selectedDate) params.append("date", selectedDate);

        const res = await fetch(`/api/sankey-communication-flows?${params.toString()}`);
        const json = await res.json();

        if (json.success && Array.isArray(json.links)) {
          drawSankeyDiagram(json.links);
        }
      } catch (err) {
        console.error("Error loading Sankey data:", err);
      }
    };

    fetchDataAndDraw();
  }, [entityId, selectedDate]);

  const drawSankeyDiagram = (data: SankeyDataItem[]) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const svgEl = svg.node();
    if (!svgEl) return;

    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;

    const sankey = d3Sankey()
      .nodeWidth(20)
      .nodePadding(20)
      .extent([[0, 0], [width, height]]);

    const nodesMap: Record<string, { name: string }> = {};
    data.forEach(d => {
      nodesMap[d.source] = { name: d.source };
      nodesMap[d.target] = { name: d.target };
    });

    const sankeyGraph: SankeyGraph<any, any> = {
      nodes: Object.values(nodesMap),
      links: data.map(d => ({
        source: d.source,
        target: d.target,
        value: d.value,
      })),
    };

    sankey(sankeyGraph);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(Object.keys(nodesMap));

    const g = svg
      .attr("viewBox", [0, 0, width, height].toString())
      .append("g");

    g.append("g")
      .selectAll("rect")
      .data(sankeyGraph.nodes)
      .enter()
      .append("rect")
      .attr("x", d => d.x0!)
      .attr("y", d => d.y0!)
      .attr("width", d => d.x1! - d.x0!)
      .attr("height", d => Math.max(1, d.y1! - d.y0!))
      .attr("fill", d => color(d.name))
      .append("title")
      .text(d => `${d.name}`);

    g.append("g")
      .selectAll("path")
      .data(sankeyGraph.links)
      .enter()
      .append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", d => color((d as any).source.name))
      .attr("stroke-width", d => Math.max(1, d.width!))
      .attr("stroke-opacity", 0.6)
      .append("title")
      .text(d => `${(d as any).source.name} → ${(d as any).target.name}: ${d.value}`);
  };

  return (
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Sankey Diagram: Communication Flow</h4>
      <svg ref={svgRef} className="w-full h-96 border rounded-lg bg-white" />
    </div>
  );
}
