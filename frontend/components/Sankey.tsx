"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  SankeyGraph,
  sankey as d3Sankey,
  sankeyLinkHorizontal,
} from "d3-sankey";

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

        // 🛡️ Only render if data is valid
        if (json.success && Array.isArray(json.links) && json.links.length > 0) {
          drawSankeyDiagram(json.links);
        } else {
          d3.select(svgRef.current).selectAll("*").remove();
        }
      } catch (err) {
        console.error("Error loading Sankey data:", err);
        d3.select(svgRef.current).selectAll("*").remove();
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

    const nodeMap = new Map<string, { name: string }>();
    data.forEach(d => {
      if (!nodeMap.has(d.source)) nodeMap.set(d.source, { name: d.source });
      if (!nodeMap.has(d.target)) nodeMap.set(d.target, { name: d.target });
    });

    const nodes = Array.from(nodeMap.values());

    const links = data.map(d => ({
      source: nodeMap.get(d.source)!,
      target: nodeMap.get(d.target)!,
      value: d.value,
    }));

    const sankeyGraph: SankeyGraph<any, any> = { nodes, links };

    sankey(sankeyGraph);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(nodes.map(d => d.name));

    const g = svg
      .attr("viewBox", [0, 0, width, height].toString())
      .append("g");

    // Tooltip div
    const tooltip = d3.select("body")
      .append("div")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "0.85rem");

    // Nodes
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
      .on("mouseover", function (event, d) {
        tooltip.html(`<strong>${d.name}</strong><br/>In: ${d.value}`)
          .style("visibility", "visible");
      })
      .on("mousemove", event => {
        tooltip.style("top", `${event.pageY + 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });

    // Links
    g.append("g")
      .selectAll("path")
      .data(sankeyGraph.links)
      .enter()
      .append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", d => color(d.source.name))
      .attr("stroke-width", d => Math.max(1, d.width!))
      .attr("stroke-opacity", 0.6)
      .on("mouseover", function (event, d) {
        tooltip.html(`
          <strong>From:</strong> ${d.source.name}<br/>
          <strong>To:</strong> ${d.target.name}<br/>
          <strong>Value:</strong> ${d.value}
        `).style("visibility", "visible");
      })
      .on("mousemove", event => {
        tooltip.style("top", `${event.pageY + 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });
  };

  return (
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Sankey Diagram: Communication Flow</h4>
      <svg ref={svgRef} className="w-full h-96 border rounded-lg bg-white" />
    </div>
  );
}
