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
// import Split from "react-split";

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
  const [sankeyHeight, setSankeyHeight] = useState<number>(800); 
  const dragRef = useRef<HTMLDivElement | null>(null);
  const sankeyDragRef = useRef<HTMLDivElement | null>(null); 
  const [allEntities, setAllEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [showTimeBar, setShowTimeBar] = useState<boolean>(true);
  const [showSankey, setShowSankey] = useState<boolean>(true);
  const [showCommunicationView, setShowCommunicationView] = useState(true);
  const [showEventsView, setShowEventsView] = useState(true);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);

  // State for CommunicationView-Filter
  const [msvStartDate, setMsvStartDate] = useState<string>("");
  const [msvEndDate, setMsvEndDate] = useState<string>("");
  const [msvEntityFilter, setMsvEntityFilter] = useState<string>("");
  const [msvKeyword, setMsvKeyword] = useState<string>("");
  const [msvData, setMsvData] = useState<any[]>([]);
  const [msvLoading, setMsvLoading] = useState(false);
  const [msvError, setMsvError] = useState<string | null>(null);
  const [resetFilterPushed, setResetFilterPushed] = useState(false);

  useEffect(() => {
    console.log("SelectedInfo: ", selectedInfo);
  }, [selectedInfo]); 

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
      .map((n: any) => ({ id: n.id, sub_type: n.sub_type || n.label }))
      .sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
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

  const [panelWidths, setPanelWidths] = useState([25, 25, 25, 25]);
  const dragIndexRef = useRef<number | null>(null);

  function handleDragStart(idx: number, e: React.MouseEvent) {
    dragIndexRef.current = idx;
    document.body.style.cursor = "col-resize";

    function onMouseMove(ev: MouseEvent) {
      const container = document.getElementById("tools-panels-row");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalWidth = rect.width;
      const x = ev.clientX - rect.left;
      let leftSum = 0;
      for (let i = 0; i < idx; i++) leftSum += panelWidths[i];
      const minPercent = 10;
      let newLeft = Math.max(minPercent, Math.min((x / totalWidth) * 100, 100 - minPercent * (4 - idx)));
      let newWidths = [...panelWidths];
      const delta = newLeft - leftSum;
      newWidths[idx - 1] += delta;
      newWidths[idx] -= delta;
      // Clamp
      newWidths = newWidths.map(w => Math.max(minPercent, w));
      setPanelWidths(newWidths);
    }

    function onMouseUp() {
      dragIndexRef.current = null;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <section className="flex flex-col h-screen">
      <div className="w-full py-6 bg-white border-b shadow-md z-40">
        <h1 className="text-3xl font-bold text-center text-blue-800 tracking-wide">
          OVA - Oceanus Visual Analytics
        </h1>
      </div>
    {/* Toggle Buttons */}
    <div className="fixed top-0 left-0 z-50">
      <button
        onClick={() => setShowFilterPanel(!showFilterPanel)}
        className="bg-blue-500 text-white px-4 py-2 rounded-r"
      >
        {showFilterPanel ? "Close Filters" : "Show Filters"}
      </button>
    </div>
    <div className="fixed top-0 right-0 z-50">
      <button
        onClick={() => setShowInfoPanel(!showInfoPanel)}
        className="bg-blue-500 text-white px-4 py-2 rounded-l"
      >
        {showInfoPanel ? "Close Info" : "Show Info"}
      </button>
    </div>

    <div className="flex flex-row flex-1 w-full">
      {/* Sidebar: FilterPanel */}
      {showFilterPanel && (
  <div className="fixed top-0 left-0 w-[320px] h-screen bg-white shadow-lg border-r z-40 flex flex-col">
    <div className="h-full overflow-y-auto">
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
        relevantEvents={relevantEvents}
        setrelevantEvents={setrelevantEvents}
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
        setResetFilterPushed={setResetFilterPushed}
      />
    </div>
  </div>
)}

      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          marginLeft: showFilterPanel ? 320 : 0,
          marginRight: showInfoPanel ? 300 : 0,
        }}
      >
        {/* GraphView */}
        <div className="border-b overflow-hidden flex flex-col items-center">
          <div
            ref={graphContainerRef}
            className="w-full flex-1 border rounded-lg"
            style={{ height: `${graphHeight}px`, width: "100%" }}
          />
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
            setResetFilterPushed={setResetFilterPushed}
            resetFilterPushed={resetFilterPushed}
          />
          {/* Resizable Drag Handle */}
          <div
            ref={dragRef}
            style={{
              cursor: "row-resize",
              height: "10px",
              width: "100%",
              background: "#e5e7eb",
            }}
            onMouseDown={() => {
              if (dragRef.current) dragRef.current.dataset.dragging = "true";
            }}
            className="mb-2"
          />
        </div>

        {/* Togglebar*/}
        <div className="w-full max-w-7xl flex items-center gap-4 mx-auto mt-2">
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
            <label htmlFor="toggle-eventsview" className="select-none">Event View</label>
          </div>
        </div>

        {/* Additional Tools  */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Card className="w-full h-full flex flex-col" style={{ maxHeight: "100vh" }}>
            <CardHeader>
              <h4 className="text-md font-semibold text-center">Additional Tools</h4>
            </CardHeader>
            <Divider />
              <CardBody className="h-full min-h-0 p-2 flex flex-col" style={{ maxHeight: "100vh" }}>
                <div className="flex w-full h-full min-h-0" id="tools-panels-row">
                  {(() => {
              const panelDefs = [
                { show: showCommunicationView, key: "comm", component: (
                  <CommunicationView
                    filterSender={filterSender}
                    setFilterSender={setFilterSender}
                    filterReceiver={filterReceiver}
                    setFilterReceiver={setFilterReceiver}
                    filterContent={filterContent}
                    visibleEntities={visibleEntities}
                    communicationEventsAfterTimeFilter={communicationEventsAfterTimeFilter}
                    filterModeMessages={filterModeMessages}
                    setFilterModeMessages={setFilterModeMessages}
                    selectedEventId={selectedEventId}
                    timestampFilterStart={timestampFilterStart}
                    timestampFilterEnd={timestampFilterEnd}
                    setTimestampFilterStart={setTimestampFilterStart}
                    setTimestampFilterEnd={setTimestampFilterEnd}
                  />
                )},
                { show: showTimeBar, key: "timebar", component: (
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
                )},
                { show: showSankey, key: "sankey", component: (
                  <Sankey
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
                )},
                { show: showEventsView, key: "events", component: (
                  <EventsView
                    eventsAfterTimeFilter={EventsAfterTimeFilter}
                    setSelectedEventId={setSelectedEventId}
                    selectedEventId={selectedEventId}
                    setFilterModeMessages={setFilterModeMessages}
                  />
                )},
              ];

              const visiblePanels = panelDefs
                .map((def, i) => ({ ...def, idx: i }))
                .filter(def => def.show);

              const totalWidth = visiblePanels.reduce((sum, panel) => sum + panelWidths[panel.idx], 0);

              const normalizedWidths = visiblePanels.map(panel =>
                (panelWidths[panel.idx] / totalWidth) * 100
              );

              const result: React.ReactNode[] = [];
              visiblePanels.forEach((panel, idx) => {
                if (idx > 0) {
                  result.push(
                    <div
                      key={`drag-${panel.idx}`}
                      style={{ cursor: "col-resize", width: 8, zIndex: 20 }}
                      className="h-full bg-gray-200 hover:bg-blue-300 transition-colors"
                      onMouseDown={e => handleDragStart(panel.idx, e)}
                    />
                  );
                }
                result.push(
                  <div
                    key={panel.key}
                    className="h-full flex flex-col min-w-[100px]"
                    style={{ width: `${normalizedWidths[idx]}%` }}
                  >
                    <div className="flex-1 min-h-0 overflow-auto">
                      {panel.component}
                    </div>
                  </div>
                );
              });
              return result;
            })()}
          </div>
            {/* Height Handle */}
            <div
              style={{
                cursor: "row-resize",
                height: "10px",
                width: "100%",
                background: "#e5e7eb",
                position: "absolute",
                left: 0,
                bottom: 0,
                zIndex: 30
              }}
              onMouseDown={e => {
                const startY = e.clientY;
                const startHeight = sankeyHeight;
                function onMouseMove(ev: MouseEvent) {
                  let newHeight = startHeight + (ev.clientY - startY);
                  newHeight = Math.max(200, Math.min(newHeight, window.innerHeight - 200));
                  setSankeyHeight(newHeight);
                }
                function onMouseUp() {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                  document.body.style.cursor = "";
                }
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "row-resize";
              }}
            />
          </CardBody>
          </Card>
        </div>
      </div>

      {/* Sidebar: InfoPanel */}
      {showInfoPanel && (
        <div className="fixed top-0 right-0 w-[300px] h-screen bg-white shadow-lg border-l z-40 flex flex-col gap-4">
          <SelectedInfoPanel selectedInfo={selectedInfo} />
          <GraphSummary
            edgeCount={edgeCount}
            edgeTypeCounts={edgeTypeCounts}
            subtypeCounts={subtypeCounts}
            entities={allEntities}
          />
        </div>
      )}
    </div>
  </section>
);

  
}
