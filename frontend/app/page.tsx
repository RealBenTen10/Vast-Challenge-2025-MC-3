"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import { Node, Link, GraphData } from "@/components/types";
import Sankey from "@/components/Sankey"; 
import EventsView from "@/components/EventsView";
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
  const timeSeriesRef = useRef<SVGSVGElement | null>(null);  

  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});
  const [edgeTypeCounts, setEdgeTypeCounts] = useState<Record<string, number>>({});  
  const [edgeCount, setEdgeCount] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"all" | "event" | "relationship">("all");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterDepth, setFilterDepth] = useState<number>(1);
  const [visibleEntities, setVisibleEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<any>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sankeyData, setSankeyData] = useState<{ source: string, target: string, value: number }[]>([]);
  const [filterContent, setFilterContent] = useState<string>("");
  const [filterSender, setFilterSender] = useState<string>("");
  const [filterReceiver, setFilterReceiver] = useState<string>("");
  const [timestampFilterStart, setTimestampFilterStart] = useState<string | null>(null);
  const [timestampFilterEnd, setTimestampFilterEnd] = useState<string | null>(null);
  const [communicationEvents, setCommunicationEvents] = useState<Node[]>([]);
  const [communicationEventsAfterTimeFilter, setCommunicationEventsAfterTimeFilter] = useState<Node[]>([]);
  const [EventsAfterTimeFilter, setEventsAfterTimeFilter] = useState<Node[]>([]);
  const [filterModeMessages, setFilterModeMessages] = useState<"all" | "filtered" | "direct" | "directed" |"evidence" | "similarity">("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [relevantEvents, setrelevantEvents] = useState<Set<string>>(new Set());


  // Don't change this function
  const callApi = async (endpoint: string) => {
    setStatusMsg(`Calling ${endpoint}...`);
    try {
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      if (endpoint === "/load-graph-json") {}
      else setGraphData({ nodes: data.nodes, links: data.links }), setStatusMsg("Graph loaded successfully.");
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };


  return (
  <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">

    {/* Top Row: Filters + Graph Summary + Selected Info */}
    <div className="flex w-full max-w-7xl gap-4">
      {/* Filters and Actions */}
      <FilterPanel 
        selectedEventTypes={selectedEventTypes}
        setSelectedEventTypes={setSelectedEventTypes}
        filterSender={filterSender}
        setFilterSender={setFilterSender}
        filterReceiver={filterReceiver}
        setFilterReceiver={setFilterReceiver}
        filterContent={filterContent}
        setFilterContent={setFilterContent}
        filterDepth={filterDepth}
        setFilterDepth={setFilterDepth}
        timestampFilterStart={timestampFilterStart}
        timestampFilterEnd={timestampFilterEnd}
        setTimestampFilterStart={setTimestampFilterStart}
        setTimestampFilterEnd={setTimestampFilterEnd}
        callApi={callApi}
        statusMsg={statusMsg}
        setGraphData={setGraphData}
        relevantEvents={relevantEvents}
        setrelevantEvents={setrelevantEvents} 
        />
      
      {/* Graph Summary */}
      <GraphSummary edgeCount={edgeCount} edgeTypeCounts={edgeTypeCounts} subtypeCounts={subtypeCounts} />

      {/* Selected Info */}
      <SelectedInfoPanel selectedInfo={selectedInfo} />
    </div>

    {/* Graph Container */}
    <div ref={graphContainerRef} className="flex-1 border rounded-lg mt-6" style={{ height: "600px", width: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
    <GraphView
      graphData={graphData}
      svgRef={svgRef}
      graphContainerRef={graphContainerRef}
      filterSender={filterSender}
      setFilterSender={setFilterSender}
      filterReceiver={filterReceiver}
      setFilterReceiver={setFilterReceiver}
      filterDepth={filterDepth}
      filterContent={filterContent}
      filterMode={filterMode}
      timestampFilterStart={timestampFilterStart}
      timestampFilterEnd={timestampFilterEnd}
      setVisibleEntities={setVisibleEntities}
      setSubtypeCounts={setSubtypeCounts}
      setEdgeTypeCounts={setEdgeTypeCounts}
      setEdgeCount={setEdgeCount}
      setSelectedInfo={setSelectedInfo}
      setCommunicationEvents={setCommunicationEvents}
      communicationEvents={communicationEvents}
      setCommunicationEventsAfterTimeFilter={setCommunicationEventsAfterTimeFilter}
      setEventsAfterTimeFilter={setEventsAfterTimeFilter}
      communicationEventsAfterTimeFilter={communicationEventsAfterTimeFilter}
      callApi={callApi}
      relevantEvents={relevantEvents}
      setrelevantEvents={setrelevantEvents}
    />

    {/* Legends */}
    <LegendPanel />
    
    {/* Time Bar Chart */}
    <TimeBarChart
      graphData={graphData}
      visibleEntities={visibleEntities}
      timestampFilterStart={timestampFilterStart}
      timestampFilterEnd={timestampFilterEnd}
      setTimestampFilterStart={setTimestampFilterStart}
      setTimestampFilterEnd={setTimestampFilterEnd}
      filterSender={filterSender}
      setFilterSender={setFilterSender}
      filterReceiver={filterReceiver}
      setFilterReceiver={setFilterReceiver}
      communicationEvents={communicationEvents}
    />

    {/* Communication View */}
    <CommunicationView
      filterSender={filterSender}
      setFilterSender={setFilterSender}
      filterReceiver={filterReceiver}
      setFilterReceiver={setFilterReceiver}
      filterContent={filterContent}
      timestampFilterStart={timestampFilterStart}
      timestampFilterEnd={timestampFilterEnd}
      visibleEntities={visibleEntities}
      communicationEventsWithTimeFilter={communicationEventsAfterTimeFilter}
      filterModeMessages={filterModeMessages}
      setFilterModeMessages={setFilterModeMessages}
      selectedEventId={selectedEventId}
    />

    {/* Event View */}
    <EventsView
      eventsAfterTimeFilter={EventsAfterTimeFilter}
      setSelectedEventId={setSelectedEventId}
      selectedEventId={selectedEventId}
      />
    
    {/* Sankey  */}
    <Sankey 
    filterSender={filterSender}
    setFilterSender={setFilterSender}
    filterReceiver={filterReceiver}
    setFilterReceiver={setFilterReceiver}
    timestampFilterStart={timestampFilterStart}
    timestampFilterEnd={timestampFilterEnd}
    filterContent={filterContent}
    setFilterModeMessages={setFilterModeMessages}
    />
    
    { /* GraphRAG LLM Component */}
    
  </section>
);

  
}
