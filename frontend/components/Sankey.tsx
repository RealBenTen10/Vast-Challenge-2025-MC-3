"use client";

import React, { useEffect, useRef } from "react";
import { Card, CardHeader, CardBody, Badge, Button } from "@heroui/react";
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
  filterSender: string;
  setFilterSender: (id: string) => void;
  filterReceiver: string;
  setFilterReceiver: (id: string) => void;
  timestampFilterStart: string;
  timestampFilterEnd: string;
  filterContent: string;
  setFilterModeMessages: (mode: "all" | "filtered" | "direct" | "directed") => void;
}

export default function Sankey({
  filterSender,
  setFilterSender,
  filterReceiver,
  setFilterReceiver,
  timestampFilterStart,
  timestampFilterEnd,
  filterContent,
  setFilterModeMessages,
}: SankeyProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!filterSender && !filterReceiver) return;

    const fetchDataAndDraw = async () => {
      try {
        const params = new URLSearchParams();
        if (filterSender) params.append("sender", filterSender);
        if (filterReceiver) params.append("receiver", filterReceiver);
        if (timestampFilterStart) params.append("start_date", timestampFilterStart);
        if (timestampFilterEnd) params.append("end_date", timestampFilterEnd);

        const res = await fetch(`/api/sankey-communication-flows?${params.toString()}`);
        const json = await res.json();

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
  }, [filterSender, filterReceiver, timestampFilterStart, timestampFilterEnd, filterContent]);

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
    data.forEach((d) => {
      if (!nodeMap.has(d.source)) nodeMap.set(d.source, { name: d.source });
      if (!nodeMap.has(d.target)) nodeMap.set(d.target, { name: d.target });
    });

    const nodes = Array.from(nodeMap.values());

    const links = data.map((d) => ({
      source: nodeMap.get(d.source)!,
      target: nodeMap.get(d.target)!,
      value: d.value,
    }));

    const sankeyGraph: SankeyGraph<any, any> = { nodes, links };
    sankey(sankeyGraph);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(nodes.map((d) => d.name));

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g");

    let tooltip = d3.select("#tooltip");
    if (tooltip.empty()) {
      tooltip = d3
      .select("body")
      .append("div")
      .attr("id", "tooltip")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "0.85rem")
      .style("opacity", 0)
      .style("pointer-events", "none");
    }
    g.append("g")
      .selectAll("rect")
      .data(sankeyGraph.nodes)
      .enter()
      .append("rect")
      .attr("x", (d) => d.x0!)
      .attr("y", (d) => d.y0!)
      .attr("width", (d) => d.x1! - d.x0!)
      .attr("height", (d) => Math.max(1, d.y1! - d.y0!))
      .attr("fill", (d) => color(d.name))
      .on("mouseover", function (event, d) {
    tooltip.html(`<strong>${d.name}</strong><br/>Total: ${d.value}`).style("visibility", "visible");
    tooltip
      .transition()
      .duration(100)
      .style("opacity", 0.9)
      .style("pointer-events", "auto");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", `${event.pageY + 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("click", function (event, d) {
        if (d.x0! < width / 2) {
          setFilterSender(d.name);
          setFilterReceiver("");
        } else {
          setFilterReceiver(d.name);
          setFilterSender("");
        }
        setFilterModeMessages("filtered");
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });

    g.append("g")
      .selectAll("text")
      .data(sankeyGraph.nodes)
      .enter()
      .append("text")
      .attr("x", (d) => (d.x0! < width / 2 ? d.x0! - 6 : d.x1! + 6))
      .attr("y", (d) => (d.y0! + d.y1!) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.x0! < width / 2 ? "end" : "start"))
      .text((d) => d.name)
      .style("font-size", "12px");

    g.append("g")
      .selectAll("path")
      .data(sankeyGraph.links)
      .enter()
      .append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", (d) => color(d.source.name))
      .attr("stroke-width", (d) => Math.max(1, d.width!))
      .attr("stroke-opacity", 0.6)
      .on("mouseover", function (event, d) {
        tooltip
          .html(`
            <strong>From:</strong> ${d.source.name}<br/>
            <strong>To:</strong> ${d.target.name}<br/>
            <strong>Value:</strong> ${d.value}
          `)
          .style("visibility", "visible");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", `${event.pageY + 10}px`)
          .style("left", `${event.pageX + 10}px`);
      })
      .on("click", function (event, d) {
        setFilterSender(d.source.name);
        setFilterReceiver(d.target.name);
        setFilterModeMessages("directed");
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });
  };

  return (
    <Card className="w-full max-w-7xl mt-8">
    <CardHeader>
      <div className="mt-2 flex flex-wrap gap-1 text-sm">
        <h4 className="text-md font-semibold mb-2">
          Sankey Diagram: Communication Flow
          {filterSender && ` from ${filterSender}`}
          {filterReceiver && ` to ${filterReceiver}`}
        </h4>
      </div>
    </CardHeader>
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 text-sm border rounded`}
          onClick={() => setFilterModeMessages("all")}
        >
          Show incoming messages as well
        </button>
      </div>
    <div className="mt-2 flex flex-wrap gap-1 text-sm">
      <span className="ml-4">  </span>
      {!filterSender && !filterReceiver && <Badge color="green"> Please select a Sender or Receiver to display Sankey Flow </Badge>}
      {filterSender && <Badge color="blue"> Following Flow is visualized: {filterSender} </Badge>}
    </div>
    <CardBody>
      <svg ref={svgRef} className="w-full h-96 border rounded-lg bg-white" />
    </CardBody>
      
    </Card>
  );
}
