"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import { Card, CardHeader, CardBody, Divider, Button, Alert } from "@heroui/react";
import React, { ReactElement, useEffect, useState, useRef } from "react";
import * as d3 from "d3";

enum QueryStatus {
  None,
  Loading,
  Success,
  Failure,
}

interface Node {
  id: string;
  label: string;
  group?: number;
  degree?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: string;
  value?: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export default function Home() {
  const [dbWriteStatus, setDbWriteStatus] = useState<QueryStatus>(QueryStatus.None);
  const [dbWriteInfo, setDbWriteInfo] = useState("");
  const [dbReadStatus, setDbReadStatus] = useState<QueryStatus>(QueryStatus.None);
  const [dbReadInfo, setDbReadInfo] = useState("");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });

  const [airportLimit, setAirportLimit] = useState<number>(5);
  const [useRunwaysFilter, setUseRunwaysFilter] = useState<boolean>(false);
  const [runways, setRunways] = useState<number>(1);
  const [useContinentFilter, setUseContinentFilter] = useState<boolean>(false);
  const [continent, setContinent] = useState<string>("");

  const [originAirport, setOriginAirport] = useState<string>("");
  const [neighbourDepth, setNeighbourDepth] = useState<number>(0);


  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  const createD3Visualization = () => {
    if (!svgRef.current || !graphContainerRef.current) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const containerWidth = graphContainerRef.current.clientWidth;
    const containerHeight = 500;

    const svg = d3.select(svgRef.current)
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .attr("viewBox", [0, 0, containerWidth, containerHeight]);

    const g = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const nodes = graphData.nodes.map(d => ({ ...d }));
    const links = graphData.links.map(link => ({
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id,
      type: link.type || '',
      value: link.value || 1
    }));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collide", d3.forceCollide(50));

    g.append("defs").selectAll("marker")
      .data(["arrow"])
      .enter().append("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      //.attr("marker-end", "url(#arrow)")
      ;

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(
        d3.drag<SVGGElement, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append("circle")
      .attr("r", (d: any) => {
        const minR = 20;
        const maxR = 50;
        const degree = d.degree || 1;
        const allDegrees = graphData.nodes.map(n => (n as any).degree || 1);
        const maxDegree = Math.max(...allDegrees, 1);
        return minR + (degree / maxDegree) * (maxR - minR);
      })
      .attr("fill", (d: any) => {
        if (d.isOrigin) return "#ff4d4d";
        return d.group ? d3.schemeCategory10[d.group % 10] : "#69b3a2";
      })
      .attr("stroke", (d: any) => d.isOrigin ? "#000" : null)
      .attr("stroke-width", (d: any) => d.isOrigin ? 3 : 1);


    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#fff")
      .text((d: any) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source as any).x)
        .attr("y1", (d: any) => (d.source as any).y)
        .attr("x2", (d: any) => (d.target as any).x)
        .attr("y2", (d: any) => (d.target as any).y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
  };

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      createD3Visualization();
    }
  }, [graphData]);

  const writeData = async () => {
    setDbWriteStatus(QueryStatus.Loading);
    try {
      const response = await fetch("/api/start_loading");
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      const result = await response.json();
      if (result.success) {
        setDbWriteStatus(QueryStatus.Success);
        setDbWriteInfo("Database loaded successfully!");
      } else {
        setDbWriteStatus(QueryStatus.Failure);
        setDbWriteInfo(`Database loading failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbWriteStatus(QueryStatus.Failure);
      setDbWriteInfo(`Database loading failed: ${error}`);
    }
  };

  const readTopAirports = async (limit: number, runways?: number, continent?: string) => {
    setDbReadStatus(QueryStatus.Loading);
    try {
      let url = `/api/top-airports?n_airports=${limit}`;
      if (runways !== undefined) url += `&runways=${runways}`;
      if (continent) url += `&continent=${continent}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      const result = await response.json();

      if (result.success) {
        setGraphData({ nodes: result.nodes, links: result["raw-data"] });
        setDbReadStatus(QueryStatus.Success);
        setDbReadInfo("Top airports fetched successfully.");
      } else {
        setDbReadStatus(QueryStatus.Failure);
        setDbReadInfo(`Fetching top airports failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbReadStatus(QueryStatus.Failure);
      setDbReadInfo(`Fetching top airports failed: ${error}`);
    }
  };

  const readAirportNeighbours = async (iata: string, depth: number) => 
  {
    if (!iata || depth < 0) {
      setDbReadInfo("Please enter a valid IATA code and neighbour depth.");
      setDbReadStatus(QueryStatus.Failure);
      return;
    }
    setDbReadStatus(QueryStatus.Loading);
    try {
      const response = await fetch(`/api/airport-neighbours?iata=${iata}&depth=${depth}`);
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);

      const result = await response.json();

      if (result.success) 
        {
        setGraphData({ nodes: result.nodes, links: result["raw-data"] });
        setDbReadStatus(QueryStatus.Success);
        setDbReadInfo("Neighbourhood graph loaded.");
      } else 
      {
        setDbReadStatus(QueryStatus.Failure);
        setDbReadInfo(`Fetching neighbour graph failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbReadStatus(QueryStatus.Failure);
      setDbReadInfo(`Fetching neighbour graph failed: ${error}`);
    }
  };


  const readContinentGraph = async () => {
    setDbReadStatus(QueryStatus.Loading);
    try {
      const response = await fetch("/api/continent-graph");
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      const result = await response.json();
  
      if (result.success) {
        setGraphData({ nodes: result.nodes, links: [] }); // no links
        setDbReadStatus(QueryStatus.Success);
        setDbReadInfo("Continent graph loaded successfully.");
      } else {
        setDbReadStatus(QueryStatus.Failure);
        setDbReadInfo(`Fetching continent graph failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbReadStatus(QueryStatus.Failure);
      setDbReadInfo(`Fetching continent graph failed: ${error}`);
    }
  };
  

  return (
    <>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Card className="w-[400px]">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md">Neo4J Database</p>
              <p className="text-small text-default-500">Load and Visualize</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <Button isLoading={dbWriteStatus === QueryStatus.Loading} onPress={writeData} color="primary">
              Load Database
            </Button>
            <Alert
              isVisible={dbWriteStatus !== QueryStatus.None}
              color={dbWriteStatus === QueryStatus.Success ? "success" : "danger"}
              title={dbWriteStatus === QueryStatus.Success ? "Success" : "Failure"}
              description={dbWriteInfo}
              className="mt-4"
            />
          </CardBody>
        </Card>

        <Card className="w-[400px] mt-8">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md">Visualization Options</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <input type="number" value={airportLimit} min="1" onChange={(e) => setAirportLimit(parseInt(e.target.value))} className="border p-2 rounded w-full mt-2" placeholder="Number of airports" />

            <div className="mt-4 flex items-center">
              <input type="checkbox" checked={useRunwaysFilter} onChange={(e) => setUseRunwaysFilter(e.target.checked)} className="mr-2" />
              Filter by Runways
            </div>

            {useRunwaysFilter && (
              <input type="number" value={runways} min="0" onChange={(e) => setRunways(parseInt(e.target.value))} className="border p-2 rounded w-full mt-2" placeholder="Minimum runways" />
            )}

            <div className="mt-4 flex items-center">
              <input type="checkbox" checked={useContinentFilter} onChange={(e) => setUseContinentFilter(e.target.checked)} className="mr-2" />
              Filter by Continent
            </div>

            {useContinentFilter && (
              <input type="text" value={continent} onChange={(e) => setContinent(e.target.value)} className="border p-2 rounded w-full mt-2" placeholder="Continent (e.g., EU)" />
            )}

            <Button
              isLoading={dbReadStatus === QueryStatus.Loading}
              onPress={() => readTopAirports(airportLimit, useRunwaysFilter ? runways : undefined, useContinentFilter ? continent : undefined)}
              className="mt-4"
              color="primary"
            >
              Show Top Airports
            </Button>

            <Button isLoading={dbReadStatus === QueryStatus.Loading} onPress={readContinentGraph} className="mt-4" color="secondary">
              Show Continent Graph
            </Button>

            <Alert
              isVisible={dbReadStatus !== QueryStatus.None}
              color={dbReadStatus === QueryStatus.Success ? "success" : "danger"}
              title={dbReadStatus === QueryStatus.Success ? "Success" : "Failure"}
              description={dbReadInfo}
              className="mt-4"
            />



            <hr className="my-4" />

            <h4 className="text-sm font-semibold">Show Airport Neighbourhood</h4>

            <input
              type="text"
              value={originAirport}
              onChange={(e) => setOriginAirport(e.target.value)}
              placeholder="IATA code"
              className="border p-2 rounded w-full mt-2"
            />

            <input
              type="number"
              min="0"
              value={neighbourDepth}
              onChange={(e) => setNeighbourDepth(parseInt(e.target.value))}
              placeholder="Neighbour depth (0–2)"
              className="border p-2 rounded w-full mt-2"
            />

            <Button
              isLoading={dbReadStatus === QueryStatus.Loading}
              onPress={() => readAirportNeighbours(originAirport, neighbourDepth)}
              className="mt-4"
              color="warning"
            >
              Show Neighbour Graph
            </Button>

          </CardBody>
        </Card>

        <div ref={graphContainerRef} className="mt-10 w-full max-w-5xl border rounded-lg" style={{ height: "600px" }}>
          <svg ref={svgRef} className="w-full h-full"></svg>
        </div>
      </section>
    </>
  );
}
