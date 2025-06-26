"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import { Node, Link, GraphData } from "@/components/types";
import Sankey from "@/components/Sankey"; 
import { Card, CardHeader, CardBody, Divider, Button, Alert, Switch } from "@heroui/react";
import React, { ReactElement, useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { sankey, sankeyLinkHorizontal, SankeyGraph } from 'd3-sankey';
import LegendPanel from "@/components/LegendPanel";
import SelectedInfoPanel from "@/components/SelectedInfoPanel";
import GraphSummary from "@/components/GraphSummary";
import CommunicationView from "@/components/CommunicationView";
import FilterPanel from "@/components/FilterPanel";
import GraphView from "@/components/GraphView";
import TimeBarChart from "@/components/TimeBarChart";

export default function Home() {
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [useAggregated, setUseAggregated] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);  // Add timeSeriesRef

  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});
  const [edgeTypeCounts, setEdgeTypeCounts] = useState<Record<string, number>>({});  // Track edge types
  const [edgeCount, setEdgeCount] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"all" | "event" | "relationship">("all");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterDepth, setFilterDepth] = useState<number>(1);
  const [visibleEntities, setVisibleEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<any>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sankeyData, setSankeyData] = useState<{ source: string, target: string, value: number }[]>([]);
  const [filterContent, setFilterContent] = useState<string>("");
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);




  // Don't change this function
  const callApi = async (endpoint: string) => {
    setStatusMsg(`Calling ${endpoint}...`);
    try {
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      if (data.success && endpoint=="/read-db-graph") setGraphData({ nodes: data.nodes, links: data.links }), setStatusMsg("Graph loaded successfully.");
      else setStatusMsg(data["error-message"]);
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };


  return (
  <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
    
    {/* Selected Info with Toggle Button and Sidepanel Wrapper */}
    <div className="fixed right-0 top-20 z-50">
      <button 
        onClick={() => setShowInfoPanel(!showInfoPanel)} 
        className="bg-blue-500 text-white px-4 py-2 rounded-l"
      >
        {showInfoPanel ? "Close Info" : "Show Info"}
      </button>
    </div>

    {/* Filters with Toggle Button and Sidepanel Wrapper */}
    <div className="fixed left-0 top-20 z-50">
      <button 
        onClick={() => setShowFilterPanel(!showFilterPanel)} 
        className="bg-blue-500 text-white px-4 py-2 rounded-r"
      >
        {showFilterPanel ? "Close Filters" : "Show Filters"}
      </button>
    </div>

    {showInfoPanel && (
      <div className="fixed top-20 right-0 w-[300px] h-[calc(100vh-5rem)] bg-white shadow-lg border-l z-40 overflow-y-auto">
        <SelectedInfoPanel selectedInfo={selectedInfo} />
      </div>
    )}


    {/* Top Row: Graph Summary + Selected Info (ohne FilterPanel) */}
    <div className="flex w-full max-w-7xl gap-4">
      {/* Graph Summary */}
      <GraphSummary edgeCount={edgeCount} edgeTypeCounts={edgeTypeCounts} subtypeCounts={subtypeCounts} />
    </div>

    {/* Graph Container */}
    <div ref={graphContainerRef} className="flex-1 border rounded-lg mt-6" style={{ height: "600px", width: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
    <GraphView
      graphData={graphData}
      svgRef={svgRef}
      graphContainerRef={graphContainerRef}
      filterEntityId={filterEntityId}
      filterDepth={filterDepth}
      filterContent={filterContent}
      filterMode={filterMode}
      selectedTimestamp={selectedTimestamp}
      setVisibleEntities={setVisibleEntities}
      setSubtypeCounts={setSubtypeCounts}
      setEdgeTypeCounts={setEdgeTypeCounts}
      setEdgeCount={setEdgeCount}
      setSelectedInfo={setSelectedInfo}
      highlightedMessageId={highlightedMessageId}
    />

    {/* Time Bar Chart */}
    <TimeBarChart
      graphData={graphData}
      selectedTimestamp={selectedTimestamp}
      setSelectedTimestamp={setSelectedTimestamp}
    />

    {/* Legends */}
    <LegendPanel />

    {/* Massive Sequence View */}
    <CommunicationView
      className="mt-6"
      onMessageClick={(id: string) => setHighlightedMessageId(`Event_Communication_${id}`)}
    />

    
    {/* Sankey  */}
    <Sankey entityId={filterEntityId} selectedDate={selectedTimestamp} />
    
    { /* GraphRAG LLM Component */}
    
  </section>
);

  
}
