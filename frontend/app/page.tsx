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
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [graphHeight, setGraphHeight] = useState<number>(600);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const [allEntities, setAllEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [showTimeBar, setShowTimeBar] = useState<boolean>(true);
  const [showSankey, setShowSankey] = useState<boolean>(true);

  // State für CommunicationView-Filter
  const [msvStartDate, setMsvStartDate] = useState<string>("");
  const [msvEndDate, setMsvEndDate] = useState<string>("");
  const [msvEntityFilter, setMsvEntityFilter] = useState<string>("");
  const [msvKeyword, setMsvKeyword] = useState<string>("");
  const [msvData, setMsvData] = useState<any[]>([]);
  const [msvLoading, setMsvLoading] = useState(false);
  const [msvError, setMsvError] = useState<string | null>(null);

  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current && dragRef.current.dataset.dragging === 'true') {
        const containerTop = graphContainerRef.current?.getBoundingClientRect().top || 0;
        let newHeight = e.clientY - containerTop;
        newHeight = Math.max(200, Math.min(newHeight, window.innerHeight - 200));
        setGraphHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (dragRef.current) dragRef.current.dataset.dragging = 'false';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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

  // Extrahiere alle Entities beim Laden des Graphen
  useEffect(() => {
    if (graphData && graphData.nodes) {
      const entities = graphData.nodes
        .filter((n: any) => n.type === "Entity")
        .map((n: any) => ({ id: n.id, sub_type: n.sub_type || n.label }));
      setAllEntities(entities);
    }
  }, [graphData]);

  // Funktion zum Laden der CommunicationView-Daten
  const loadMSV = async () => {
    setMsvLoading(true);
    setMsvError(null);
    try {
      const params = new URLSearchParams();
      if (msvStartDate) params.append("start_date", msvStartDate);
      if (msvEndDate) params.append("end_date", msvEndDate);
      if (msvEntityFilter) params.append("entity_ids", msvEntityFilter);
      if (msvKeyword) params.append("keyword", msvKeyword);
      const res = await fetch(`/api/massive-sequence-view?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMsvData(data.data);
      } else {
        setMsvError(data.error || "Failed to load data");
      }
    } catch (err) {
      setMsvError(String(err));
    } finally {
      setMsvLoading(false);
    }
  };

  return (
  <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
    {/* Toggle Node-Link Diagram, Time Bar Chart & Sankey Checkbox */}
    <div className="w-full max-w-7xl flex items-center gap-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="toggle-graph"
          checked={showGraph}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowGraph(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="toggle-graph" className="select-none">Node-Link Diagram</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="toggle-timebar"
          checked={showTimeBar}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowTimeBar(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="toggle-timebar" className="select-none">Communication Time Bar Chart</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="toggle-sankey"
          checked={showSankey}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowSankey(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="toggle-sankey" className="select-none">Sankey Diagramm</label>
      </div>
    </div>

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
      <div className="fixed top-20 right-0 w-[300px] h-[calc(100vh-5rem)] bg-white shadow-lg border-l z-40 overflow-y-auto flex flex-col gap-4">
        <SelectedInfoPanel selectedInfo={selectedInfo} />
        <GraphSummary edgeCount={edgeCount} edgeTypeCounts={edgeTypeCounts} subtypeCounts={subtypeCounts} entities={allEntities} />
      </div>
    )}

    {showFilterPanel && (
      <div className="fixed top-20 left-0 w-[320px] h-[calc(100vh-5rem)] bg-white shadow-lg border-r z-40 overflow-y-auto">
        <FilterPanel 
          graphData={graphData}
          setGraphData={setGraphData}
          callApi={callApi}
          setSelectedEventTypes={setSelectedEventTypes}
          setSubtypeCounts={setSubtypeCounts}
          setEdgeTypeCounts={setEdgeTypeCounts}
          setEdgeCount={setEdgeCount}
          setSelectedInfo={setSelectedInfo}
          setHighlightedMessageId={setHighlightedMessageId}
          setShowInfoPanel={setShowInfoPanel}
          setShowFilterPanel={setShowFilterPanel}
          filterEntityId={filterEntityId}
          setFilterEntityId={setFilterEntityId}
          filterDepth={filterDepth}
          setFilterDepth={setFilterDepth}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          selectedTimestamp={selectedTimestamp}
          setSelectedTimestamp={setSelectedTimestamp}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          filterContent={filterContent}
          setFilterContent={setFilterContent}
          highlightedMessageId={highlightedMessageId}
          // CommunicationView Filter
          msvStartDate={msvStartDate}
          setMsvStartDate={setMsvStartDate}
          msvEndDate={msvEndDate}
          setMsvEndDate={setMsvEndDate}
          msvEntityFilter={msvEntityFilter}
          setMsvEntityFilter={setMsvEntityFilter}
          msvKeyword={msvKeyword}
          setMsvKeyword={setMsvKeyword}
          loadMSV={loadMSV}
        />
      </div>
    )}

    {/* Top Row: Graph Summary + Selected Info (ohne FilterPanel) */}
    <div className="flex w-full max-w-7xl gap-4">
      {/* Graph Summary entfernt, da jetzt im InfoPanel */}
    </div>

    {/* Graph + Sankey nebeneinander */}
    {(showGraph || showSankey) && (
      <div className="w-full flex flex-row gap-4 items-start">
        {showGraph && (
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <div ref={graphContainerRef} className="flex-1 border rounded-lg mt-6" style={{ height: `${graphHeight}px`, width: "100%" }}>
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
              graphHeight={graphHeight}
            />
            {/* Resizable Drag Handle */}
            <div
              ref={dragRef}
              style={{ cursor: 'row-resize', height: '10px', width: '100%', background: '#e5e7eb' }}
              onMouseDown={() => { if (dragRef.current) dragRef.current.dataset.dragging = 'true'; }}
              className="mb-2"
            />
          </div>
        )}
        {showSankey && (
          <div className="flex-1 min-w-0 mt-6">
            <Sankey entityId={filterEntityId} selectedDate={selectedTimestamp} />
          </div>
        )}
      </div>
    )}

    {/* Time Bar Chart und CommunicationView nebeneinander */}
    {(showTimeBar || true) && (
      <div className="w-full max-w-7xl flex flex-row gap-4 items-start mt-4">
        {showTimeBar && (
          <div className="flex-1 min-w-0">
            <TimeBarChart
              graphData={graphData}
              selectedTimestamp={selectedTimestamp}
              setSelectedTimestamp={setSelectedTimestamp}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <CommunicationView
            className="mt-0"
            onMessageClick={(id: string) => setHighlightedMessageId(`Event_Communication_${id}`)}
            msvData={msvData}
            msvLoading={msvLoading}
            msvError={msvError}
          />
        </div>
      </div>
    )}

    {/* Massive Sequence View */}
    
  </section>
);

  
}
