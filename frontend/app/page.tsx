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
  const [commGraphData, setCommGraphData] = useState<GraphData>({ nodes: [], links: [] });
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
  const [communicationEventsAfterTimeFilter, setCommunicationEventsAfterTimeFilter] = useState<string[]>([]);
  const [EventsAfterTimeFilter, setEventsAfterTimeFilter] = useState<Node[]>([]);
  const [filterModeMessages, setFilterModeMessages] = useState<"all" | "filtered" | "direct" | "directed" |"evidence" | "similarity">("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [relevantEvents, setrelevantEvents] = useState<Set<string>>(new Set());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [graphHeight, setGraphHeight] = useState<number>(550);
  const [sankeyHeight, setSankeyHeight] = useState<number>(800); // Add state for Sankey height
  const dragRef = useRef<HTMLDivElement | null>(null);
  const sankeyDragRef = useRef<HTMLDivElement | null>(null); // Ref for Sankey drag handle
  const [allEntities, setAllEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [showTimeBar, setShowTimeBar] = useState<boolean>(true);
  const [showSankey, setShowSankey] = useState<boolean>(true);
  const [showCommunicationView, setShowCommunicationView] = useState(true);
  const [showEventsView, setShowEventsView] = useState(true);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);

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
      if (sankeyDragRef.current && sankeyDragRef.current.dataset.dragging === 'true') {
        const containerTop = sankeyDragRef.current.parentElement?.getBoundingClientRect().top || 0;
        let newHeight = e.clientY - containerTop;
        newHeight = Math.max(150, Math.min(newHeight, window.innerHeight - 200));
        setSankeyHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (dragRef.current) dragRef.current.dataset.dragging = 'false';
      if (sankeyDragRef.current) sankeyDragRef.current.dataset.dragging = 'false';
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
      if (endpoint === "/load-graph-json") {}
      else setGraphData({ nodes: data.nodes, links: data.links }), setStatusMsg("Graph loaded successfully."), setCommGraphData({ nodes: data.comm_nodes, links: data.comm_links });
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };

  useEffect(() => {
    if (graphData && graphData.nodes) {
      const entities = graphData.nodes
        .filter((n: any) => n.type === "Entity")
        .map((n: any) => ({ id: n.id, sub_type: n.sub_type || n.label }));
      setAllEntities(entities);
    }
  }, [graphData]);

  useEffect(() => {
    if (selectedInfo) {
      setShowInfoPanel(true);
    }
  }, [selectedInfo]);

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

  function findCommAggNodeIdForEvent(eventId: string) {
    const commAggNode = graphData.nodes.find(
      (n: any) => n.type === "CommunicationAggregate" && Array.isArray(n.event_ids) && n.event_ids.includes(eventId)
    );
    return commAggNode ? commAggNode.id : null;
  }

  function nodeIdExists(nodeId: string | null) {
    if (!nodeId) return false;
    return graphData.nodes.some((n: any) => n.id === nodeId);
  }

  useEffect(() => {
    if (highlightedMessageId && !nodeIdExists(highlightedMessageId)) {
      setHighlightedMessageId(null);
    }
  }, [graphData]);

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
          filterSender={filterSender}
          setFilterSender={setFilterSender}
          filterReceiver={filterReceiver}
          setFilterReceiver={setFilterReceiver}
          timestampFilterStart={timestampFilterStart}
          timestampFilterEnd={timestampFilterEnd}
          setTimestampFilterStart={setTimestampFilterStart}
          setTimestampFilterEnd={setTimestampFilterEnd}
          statusMsg={statusMsg}
          setGraphData={setGraphData}
          relevantEvents={relevantEvents}
          setrelevantEvents={setrelevantEvents} 
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
          allEntities={allEntities}
        />
      </div>
    )}

    {/* Top Row: Graph Summary + Selected Info */}
    <div className="flex w-full max-w-7xl gap-4">
    </div>

    {/* Graph */}
    {showGraph && (
      <div className="w-full flex-1 min-w-0 flex flex-col items-center">
        <div ref={graphContainerRef} className="w-full flex-1 border rounded-lg mt-6" style={{ height: `${graphHeight}px`, width: "100%" }}>
        </div>
        <GraphView
          graphData={graphData}
          svgRef={svgRef}
          graphContainerRef={graphContainerRef}
          filterSender={filterSender}
          setFilterSender={setFilterSender}
          filterReceiver={filterReceiver}
          setFilterReceiver={setFilterReceiver}
          filterEntityId={filterEntityId}
          filterDepth={filterDepth}
          filterContent={filterContent}
          filterMode={filterMode}
          timestampFilterStart={timestampFilterStart}
          timestampFilterEnd={timestampFilterEnd}
          selectedTimestamp={selectedTimestamp}
          setVisibleEntities={setVisibleEntities}
          setSubtypeCounts={setSubtypeCounts}
          setEdgeTypeCounts={setEdgeTypeCounts}
          setEdgeCount={setEdgeCount}
          setSelectedInfo={setSelectedInfo}
          highlightedMessageId={highlightedMessageId}
          graphHeight={graphHeight}
          setCommunicationEvents={setCommunicationEvents}
          communicationEvents={communicationEvents}
          setCommunicationEventsAfterTimeFilter={setCommunicationEventsAfterTimeFilter}
          setEventsAfterTimeFilter={setEventsAfterTimeFilter}
          communicationEventsAfterTimeFilter={communicationEventsAfterTimeFilter}
          callApi={callApi}
          relevantEvents={relevantEvents}
          setrelevantEvents={setrelevantEvents}
          commGraphData={commGraphData}
          setSelectedEventId={setSelectedEventId}
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

        {/* Toggle CommunicationVIew,Time Bar Chart, Sankey and EventView Checkbox */}
    <div className="w-full max-w-7xl flex items-center gap-4">
            <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id="toggle-communicationview"
      checked={showCommunicationView}
      onChange={(e) => setShowCommunicationView(e.target.checked)}
      className="mr-2"
    />
    <label htmlFor="toggle-communicationview" className="select-none">Communication View</label>
    </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="toggle-timebar"
          checked={showTimeBar}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowTimeBar(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="toggle-timebar" className="select-none">Time Bar Chart</label>
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

    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="toggle-eventsview"
        checked={showEventsView}
        onChange={(e) => setShowEventsView(e.target.checked)}
        className="mr-2"
      />
      <label htmlFor="toggle-eventsview" className="select-none">Event Communication View</label>
    </div>
    </div>

    {/* CommunicationView, Time Bar Chart, Sankey  und EventsView nebeneinander */}
    {(true || showTimeBar || showSankey || true) && (
      <Card className="w-full mt-8 mx-0 px-0">
        <CardHeader>
          <div className="flex flex-wrap gap-1 text-sm">
            <h4 className="text-md font-semibold mb-2">
              Additional Tools
            </h4>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="w-full flex gap-4 items-center">
            {/* CommunicationView */}
            {showCommunicationView && (
            <div className="flex-1 min-w-0">
              <CommunicationView
                className="mt-0"
                onMessageClick={(id: string) => {
                  let eventId = id;
                  if (typeof id === "string" && id.startsWith("Event_Communication_")) eventId = id.replace("Event_Communication_", "");
                  const aggId = findCommAggNodeIdForEvent(eventId);
                  if (aggId && nodeIdExists(aggId)) {
                    setHighlightedMessageId(aggId);
                  } else {
                    setHighlightedMessageId(null);
                  }
                }}
                msvData={msvData}
                msvLoading={msvLoading}
                msvError={msvError}
                filterSender={filterSender}
                setFilterSender={setFilterSender}
                filterReceiver={filterReceiver}
                setFilterReceiver={setFilterReceiver}
                filterContent={filterContent}
                timestampFilterStart={timestampFilterStart}
                timestampFilterEnd={timestampFilterEnd}
                visibleEntities={visibleEntities}
                communicationEventsAfterTimeFilter={communicationEventsAfterTimeFilter}
                filterModeMessages={filterModeMessages}
                setFilterModeMessages={setFilterModeMessages}
                selectedEventId={selectedEventId}
              />
            </div>
            )}

            {/* Time Bar Chart */}
            {showTimeBar && (
              <div className="flex-1 min-w-0">
                <TimeBarChart
                  graphData={graphData}
                  selectedTimestamp={selectedTimestamp}
                  setSelectedTimestamp={setSelectedTimestamp}
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
              </div>
            )}

            {/* Sankey Diagram */}
            {showSankey && (
              <div className="flex-1 min-w-0 mt-6" style={{height: sankeyHeight}}>
                <Sankey 
                  entityId={filterEntityId} 
                  selectedDate={selectedTimestamp} 
                  height={sankeyHeight} 
                  filterSender={filterSender}
                  setFilterSender={setFilterSender}
                  filterReceiver={filterReceiver}
                  setFilterReceiver={setFilterReceiver}
                  timestampFilterStart={timestampFilterStart}
                  timestampFilterEnd={timestampFilterEnd}
                  filterContent={filterContent}
                  setFilterModeMessages={setFilterModeMessages}
                />
              </div>
            )}

            {/* Events View */}
             {showEventsView && (
            <div className="flex-1 min-w-0">
              <EventsView
                eventsAfterTimeFilter={EventsAfterTimeFilter}
                setSelectedEventId={setSelectedEventId}
                selectedEventId={selectedEventId}
                setFilterModeMessages={setFilterModeMessages}
              />
            </div>
             )}
          </div>
        </CardBody>
      </Card>
    )}

  </section>
);

  
}
