"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Node } from "./types";

interface TimeBarChartProps {
  graphData: { nodes: Node[] };
  selectedTimestamp: string | null;
  setSelectedTimestamp: (date: string) => void;
}

const TimeBarChart: React.FC<TimeBarChartProps> = ({
  graphData,
  selectedTimestamp,
  setSelectedTimestamp,
}) => {
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!timeSeriesRef.current || graphData.nodes.length === 0) return;
    d3.select(timeSeriesRef.current).selectAll("*").remove();

    const timestamps: string[] = graphData.nodes
      .filter(node => node.type?.toLowerCase() === "event" && node.timestamp)
      .map(node => node.timestamp);

    if (timestamps.length === 0) return;

    const parsedDates = timestamps.map(ts => new Date(ts)).filter(d => !isNaN(d.getTime()));
    const dateCounts: Record<string, number> = {};
    parsedDates.forEach(date => {
      const day = date.toISOString().split("T")[0];
      dateCounts[day] = (dateCounts[day] || 0) + 1;
    });

    const data = Object.entries(dateCounts).map(([date, count]) => ({
      date: new Date(date),
      count
    }));

    const svg = d3.select(timeSeriesRef.current);
    const width = svg.node()?.clientWidth || 600;
    const height = svg.node()?.clientHeight || 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleTime().domain(d3.extent(data, d => d.date) as [Date, Date]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) || 1]).nice().range([innerHeight, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5));

    g.append("g").call(d3.axisLeft(y));

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "4px 8px")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => x(d.date) - 4)
      .attr("y", d => y(d.count))
      .attr("width", 8)
      .attr("height", d => innerHeight - y(d.count))
      .attr("fill", "#1f77b4")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#ff7f0e");
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`<strong>${d.date.toISOString().split("T")[0]}</strong><br/>Count: ${d.count}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#1f77b4");
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .on("click", (event, d) => {
        const clickedDate = d.date.toISOString().split("T")[0];
        setSelectedTimestamp(clickedDate);
      });

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .text("Date");

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -30)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .text("Event Count");
  }, [graphData, selectedTimestamp]);

  return (
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Communication Time Bar Chart</h4>
      <svg ref={timeSeriesRef} className="w-full h-60"></svg>
    </div>
  );
};

export default TimeBarChart;
