"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Node, Link, GraphData } from "./types";


interface TimeBarChartProps {
  graphData: GraphData;
  filterSender: string;
  filterReceiver: string;
  filterDepth: number;
  timestampFilterStart: string;
  timestampFilterEnd: string;
  setTimestampFilterStart: (start: string) => void;
  setTimestampFilterEnd: (end: string) => void;
}

const TimeBarChart: React.FC<TimeBarChartProps> = ({
  graphData,
  filterSender,
  filterReceiver,
  filterDepth,
  timestampFilterStart,
  timestampFilterEnd,
  setTimestampFilterStart,
  setTimestampFilterEnd
}) => {
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!timeSeriesRef.current || graphData.nodes.length === 0) return;
    d3.select(timeSeriesRef.current).selectAll("*").remove();

    const getRelevantNodeIds = (): Set<string> => {
      const visible = new Set<string>();
      const queue = [filterSender, filterReceiver].filter(Boolean);
      let level = 0;

      while (queue.length > 0 && level <= filterDepth) {
        const nextQueue: string[] = [];
        for (const id of queue) {
          if (visible.has(id)) continue;
          visible.add(id);
          const neighbors = graphData.links.filter(link =>
            link.type === "COMMUNICATION" &&
            (link.source === id || link.target === id)
          ).map(link =>
            link.source === id ? link.target as string : link.source as string
          );
          nextQueue.push(...neighbors);
        }
        queue.length = 0;
        queue.push(...nextQueue);
        level++;
      }

      return visible;
    };

    const allowedEntities = getRelevantNodeIds();

    const filteredTimestamps = graphData.nodes
      .filter(node =>
        node.type?.toLowerCase() === "event" &&
        node.timestamp &&
        (!filterSender && !filterReceiver || // if no filters, accept all
          graphData.links.some(link =>
            link.type === "COMMUNICATION" &&
            link.source === node.id &&
            allowedEntities.has(link.target as string) ||
            link.target === node.id &&
            allowedEntities.has(link.source as string)
          )
        )
      )
      .map(node => new Date(node.timestamp!))
      .filter(date => !isNaN(date.getTime()));

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
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 1])
      .nice()
      .range([innerHeight, 0]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(10));

    g.append("g").call(d3.axisLeft(y));

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute")
      .style("background", "#fff")
      .style("padding", "5px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("opacity", 0);

    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => x(d.date))
      .attr("y", d => y(d.count))
      .attr("width", 6)
      .attr("height", d => innerHeight - y(d.count))
      .attr("fill", "#1f77b4")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#ff7f0e");
        tooltip.transition().duration(100).style("opacity", 0.9);
        tooltip.html(`<strong>${d.date.toISOString()}</strong><br/>Count: ${d.count}`)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#1f77b4");
        tooltip.transition().duration(200).style("opacity", 0);
      });
    
    // D3 Brush for range selection
    const brush = d3.brushX<Date>()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("end", (event) => {
        const selection = event.selection;
        if (!selection) return;
        const [x0, x1] = selection;
        const start = x.invert(x0).toISOString().slice(0, 19);
        const end = x.invert(x1).toISOString().slice(0, 19);
        setTimestampFilterStart(start);
        setTimestampFilterEnd(end);
        console.error(`Brush selection: ${start} to ${end}`);
        
      });

    g.append("g").attr("class", "brush").call(brush);

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
    filterSender,
    filterReceiver,
    filterDepth,
    timestampFilterStart,
    timestampFilterEnd,
    setTimestampFilterStart,
    setTimestampFilterEnd
  ]);

  return (
    <div className="w-full max-w-7xl mt-6">
      <h4 className="text-md font-semibold mb-2">Hourly Communication Activity</h4>
      <svg ref={timeSeriesRef} className="w-full h-64 border rounded bg-white" />
    </div>
  );
};

export default TimeBarChart;
