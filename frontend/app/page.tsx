"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { Node, Link, GraphData } from "@/components/types";
import Sankey from "@/components/Sankey";
import GraphView from "@/components/GraphView";
import TimeSeriesView from "@/components/TimeSeriesView";
import MassiveSequenceView from "@/components/MassiveSequenceView";
import GraphSummary from "@/components/GraphSummary";
import SelectedInfoCard from "@/components/SelectedInfoCard";
import FilterPanel from "@/components/FilterPanel";
import SelectedInfoPanel from "@/components/SelectedInfoPanel";
import GraphContainer from "@/components/GraphContainer";
import LegendPanel from "@/components/LegendPanel";


export default function Home() {
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [useAggregated, setUseAggregated] = useState<boolean>(false);

  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});
  const [edgeTypeCounts, setEdgeTypeCounts] = useState<Record<string, number>>({});
  const [edgeCount, setEdgeCount] = useState<number>(0);
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterDepth, setFilterDepth] = useState<number>(1);
  const [visibleEntities, setVisibleEntities] = useState<{ id: string; sub_type?: string }[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<any>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [filterContent, setFilterContent] = useState<string>("");
  const [timeSeriesData, setTimeSeriesData] = useState<{ date: string; count: number }[]>([]);

  const callApi = async (endpoint: string) => {
    setStatusMsg(`Calling ${endpoint}...`);
    try {
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      setStatusMsg(data.message || JSON.stringify(data));
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };

  const loadGraph = async () => {
    try {
      const res = await fetch(`/api/read-db-graph`);
      const data = await res.json();
      if (data.success) setGraphData({ nodes: data.nodes, links: data.links });
      else setStatusMsg(data["error-message"]);
    } catch (err) {
      setStatusMsg(`Graph loading failed: ${err}`);
    }
  };

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const dateCounts: Record<string, number> = {};
      graphData.nodes.forEach((node) => {
        if (node.type === "Event" && node.timestamp) {
          const dateStr = node.timestamp.split("T")[0];
          dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
        }
      });
      const processed = Object.entries(dateCounts).map(([date, count]) => ({ date, count }));
      setTimeSeriesData(processed);
    }
  }, [graphData]);

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="flex w-full max-w-7xl gap-4">
        <FilterPanel
          selectedEventTypes={selectedEventTypes}
          setSelectedEventTypes={setSelectedEventTypes}
          filterEntityId={filterEntityId}
          setFilterEntityId={setFilterEntityId}
          filterContent={filterContent}
          setFilterContent={setFilterContent}
          filterDepth={filterDepth}
          setFilterDepth={setFilterDepth}
          callApi={callApi}
          loadGraph={loadGraph}
          statusMsg={statusMsg}
        />

        <GraphSummary
          edgeTypeCounts={edgeTypeCounts}
          edgeCount={edgeCount}
          subtypeCounts={subtypeCounts}
        />

        <SelectedInfoCard selectedInfo={selectedInfo} />
      </div>

      <GraphView
        graphData={graphData}
        filterEntityId={filterEntityId}
        filterDepth={filterDepth}
        filterContent={filterContent}
        selectedTimestamp={selectedTimestamp}
        selectedEventTypes={selectedEventTypes}
        setEdgeTypeCounts={setEdgeTypeCounts}
        setEdgeCount={setEdgeCount}
        setSubtypeCounts={setSubtypeCounts}
        setVisibleEntities={setVisibleEntities}
        setSelectedInfo={setSelectedInfo}
      />

      {filterEntityId && (
        <Sankey entityId={filterEntityId} selectedDate={selectedTimestamp} />
      )}

     

      <MassiveSequenceView className="mt-6" />
    </section>
  );
}
