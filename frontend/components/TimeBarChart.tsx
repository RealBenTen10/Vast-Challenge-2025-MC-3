"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Node, Link, GraphData } from "./types";

interface TimeBarChartProps {
  graphData: GraphData;
  visibleEntities: { id: string; sub_type?: string }[]; 
  timestampFilterStart: string;
  timestampFilterEnd: string;
  setTimestampFilterStart: (start: string) => void;
  setTimestampFilterEnd: (end: string) => void;
  communicationEvents: Node[];
}

const TimeBarChart: React.FC<TimeBarChartProps> = ({
  graphData,
  visibleEntities, 
  timestampFilterStart,
  timestampFilterEnd,
  setTimestampFilterStart,
  setTimestampFilterEnd,
  communicationEvents
}) => {
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!timeSeriesRef.current || graphData.nodes.length === 0) return;
    d3.select(timeSeriesRef.current).selectAll("*").remove();

    const visibleSet = new Set(visibleEntities);


    const parseAsUTC = (timestamp: string) =>
  new Date(timestamp.replace(" ", "T") + "Z");

  const filteredTimestamps = communicationEvents
  .map(node => parseAsUTC(node.timestamp!))
  .filter(date => !isNaN(date.getTime()));

    console.log(filteredTimestamps)

    if (filteredTimestamps.length === 0) return;

    const grouped = d3.rollup(
      filteredTimestamps,
      v => v.length,
      d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours())
    );

    const data = Array.from(grouped.entries()).map(([date, count]) => ({
      date: date as Date,
      count: count as number
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    const svg = d3.select(timeSeriesRef.current);
    const width = svg.node()?.clientWidth || 600;
    const height = svg.node()?.clientHeight || 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleTime()
      .domain([
        new Date("2040-10-01T00:00:00"),
        new Date("2040-10-15T00:00:00")
      ])
      .range([0, innerWidth]);


    const y = d3.scaleLinear()
    .domain([0, 25]) 
    .range([innerHeight, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const brush = d3.brushX()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("end", (event) => {
        const selection = event.selection;
        if (!selection) return;
        const [x0, x1] = selection;
        const start = x.invert(x0).toISOString().slice(0, 19);
        const end = x.invert(x1).toISOString().slice(0, 19);
        setTimestampFilterStart(start);
        setTimestampFilterEnd(end);
      });

    g.append("g").attr("class", "brush").call(brush);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(10));

    g.append("g").call(d3.axisLeft(y));

    let tooltip = d3.select("#tooltip");

    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("opacity", 0)
        .style("pointer-events", "none");
    }
    

    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .classed("bar", true)
      .attr("x", d => x(d.date) - 6 / 2)
      .attr("y", d => y(d.count))
      .attr("width", 6)
      .attr("height", d => innerHeight - y(d.count))
      .attr("fill", d => {
        const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
        const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;
        if (start) start.setHours(start.getHours() + 2);
        if (end) end.setHours(end.getHours() + 2);
        const inRange = start && end && d.date >= start && d.date < end;
        return inRange ? "green" : "#1f77b4";
      })
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#ff7f0e");
        tooltip
          .transition()
          .duration(100)
          .style("opacity", 0.9)
          .style("pointer-events", "auto");
        tooltip
        .html(`<strong>${d.date.toLocaleString("sv-SE", { timeZone: "UTC" })}</strong><br/>Count: ${d.count}`)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function (event, d) {
        const start = timestampFilterStart ? new Date(timestampFilterStart) : null;
        const end = timestampFilterEnd ? new Date(timestampFilterEnd) : null;
        if (start) start.setHours(start.getHours() + 2);
        if (end) end.setHours(end.getHours() + 2);  
        const inRange = start && end && d.date >= start && d.date < end;
        d3.select(this).attr("fill", inRange ? "green" : "#1f77b4");
        tooltip
        .transition()
        .duration(200)
        .style("opacity", 0)
        .style("pointer-events", "none");
      })
      .on("click", function (event, d) {
        const start = new Date(d.date);
        const end = new Date(start);
        tooltip
        .transition()
        .duration(200)
        .style("opacity", 0)
        .style("pointer-events", "none");
        end.setHours(end.getHours() + 1); // 1-hour bin
        setTimestampFilterStart(start.toISOString().slice(0, 19));
        setTimestampFilterEnd(end.toISOString().slice(0, 19));
      });

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 35)
      .attr("text-anchor", "middle")
      .text("Hour");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -35)
      .attr("text-anchor", "middle")
      .text("Event Count");

    
  }, [
    graphData,
    visibleEntities,
    timestampFilterStart,
    timestampFilterEnd,
    communicationEvents
  ]);

  return (
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Hourly Communication Activity</h4>
      <svg ref={timeSeriesRef} className="w-full h-64 border rounded bg-white" />
    </div>
  );
};

export default TimeBarChart;
