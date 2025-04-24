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

// Define types for our graph data
interface Node {
  id: string;
  label: string;
  group?: number;
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
  const [dbReadText, setDbReadText] = useState<ReactElement | null>(null);
  const [dbReadInfo, setDbReadInfo] = useState("");
  const [titleColor, setTitleColor] = useState("");
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  
  // Create refs for D3 visualization
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  const titleColorArray = ["yellow", "green", "blue", "violet", "cyan", "pink"];

  useEffect(() => {
    if (!titleColor) {
      const randomColor = titleColorArray[Math.floor(Math.random() * titleColorArray.length)];
      setTitleColor(randomColor);
    }
  }, [titleColor]);

  // Effect for handling D3 visualization
  useEffect(() => {
    if (graphData.nodes.length > 0 && svgRef.current) {
      createD3Visualization();
    }
  }, [graphData]);

  // Function to create D3 visualization
  const createD3Visualization = () => {
    if (!svgRef.current || !graphContainerRef.current) return;

    // Clear any existing visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // Get dimensions of the container
    const containerWidth = graphContainerRef.current.clientWidth;
    const containerHeight = 500; // Fixed height or you can make this dynamic

    // Create a copy of the graph data with proper D3 force simulation structure
    const d3Data = {
      nodes: [...graphData.nodes],
      links: graphData.links.map(link => ({
        source: typeof link.source === 'string' ? link.source : link.source.id,
        target: typeof link.target === 'string' ? link.target : link.target.id,
        type: link.type || '',
        value: link.value || 1
      }))
    };

    // Create a force simulation
    const simulation = d3.forceSimulation(d3Data.nodes)
      .force("link", d3.forceLink(d3Data.links)
        .id((d: any) => d.id)
        .distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collide", d3.forceCollide().radius(50));

    // Create SVG element with dimensions
    const svg = d3.select(svgRef.current)
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .attr("viewBox", [0, 0, containerWidth, containerHeight]);

    // Add zoom functionality
    const g = svg.append("g");
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create arrow marker for directed links
    svg.append("defs").selectAll("marker")
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

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(d3Data.links)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => Math.sqrt(d.value))
      .attr("marker-end", "url(#arrow)");

    // Create relationship type labels
    const linkLabels = g.append("g")
      .selectAll("text")
      .data(d3Data.links)
      .enter().append("text")
      .text((d: any) => d.type)
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .attr("dy", -5);

    // Create node groups
    const node = g.append("g")
      .selectAll("g")
      .data(d3Data.nodes)
      .enter().append("g")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Add circles to nodes
    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => d.group ? d3.schemeCategory10[d.group % 10] : "#69b3a2");

    // Add text labels
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#fff")
      .text((d: any) => d.label);

    // Define simulation tick function
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabels
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  const writeData = async () => {
    setDbWriteStatus(QueryStatus.Loading);

    try {
      const response = await fetch("/api/start_loading");
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);

      const result = await response.json();

      if (result.success) {
        setDbWriteStatus(QueryStatus.Success);
        setDbWriteInfo("The database was filled with example data!");
      } else {
        setDbWriteStatus(QueryStatus.Failure);
        setDbWriteInfo(`Writing database failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbWriteStatus(QueryStatus.Failure);
      setDbWriteInfo(`Writing database failed: ${error}`);
    }
  };

  // Function to transform raw data from Neo4j to D3 format
  const transformToGraphData = (rawData: any): GraphData => {
    // This is a placeholder transformation - adjust based on your actual data structure
    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeMap = new Map();

    // Assuming rawData is an array of connections where each has source and target nodes
    rawData.forEach((connection: any, index: number) => {
      // Check how your connection data is structured
      // This example assumes each connection has source and target properties
      const source = connection.source || connection.from || `node-${index}-a`;
      const target = connection.target || connection.to || `node-${index}-b`;
      const relationshipType = connection.type || 'CONNECTS_TO';
      
      // Add source node if not exists
      if (!nodeMap.has(source)) {
        nodeMap.set(source, true);
        nodes.push({
          id: source,
          label: connection.sourceLabel || source,
          group: 1
        });
      }
      
      // Add target node if not exists
      if (!nodeMap.has(target)) {
        nodeMap.set(target, true);
        nodes.push({
          id: target,
          label: connection.targetLabel || target,
          group: 2
        });
      }
      
      // Add link
      links.push({
        source,
        target,
        type: relationshipType,
        value: 1
      });
    });

    return { nodes, links };
  };

  const readData = async () => {
    setDbReadStatus(QueryStatus.Loading);

    try {
      const response = await fetch("/api/read-db-example");
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);

      const result = await response.json();

      if (result.success) {
        const dbContent: string[] = result["db-content"];

        const content = dbContent.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            <br />
          </React.Fragment>
        ));

        setDbReadText(<>{content}</>);
        
        // Transform the data for visualization
        if (result["raw-data"]) {
          const transformedData = transformToGraphData(result["raw-data"]);
          setGraphData(transformedData);
        } else {
          // Fallback to creating a sample graph if no proper data structure is available
          createSampleGraphFromText(dbContent);
        }
        
        setDbReadStatus(QueryStatus.Success);
        setDbReadInfo("The database returned valid data!");
      } else {
        setDbReadStatus(QueryStatus.Failure);
        setDbReadInfo(`Querying database failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbReadStatus(QueryStatus.Failure);
      setDbReadInfo(`Querying database failed: ${error}`);
    }
  };

  // Fallback function to create a sample graph from text data
  const createSampleGraphFromText = (textData: string[]) => {
    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeMap = new Map();
    
    // This is a very simple parsing approach - adjust based on your actual data format
    textData.forEach((line, index) => {
      // Try to extract relationship pattern like (A)-[RELATION]->(B)
      const match = line.match(/\(([^)]+)\)-\[([^\]]+)\]->\(([^)]+)\)/);
      
      if (match) {
        const [_, sourceNode, relation, targetNode] = match;
        
        // Add source node if not exists
        if (!nodeMap.has(sourceNode)) {
          nodeMap.set(sourceNode, true);
          nodes.push({ 
            id: sourceNode, 
            label: sourceNode,
            group: 1
          });
        }
        
        // Add target node if not exists
        if (!nodeMap.has(targetNode)) {
          nodeMap.set(targetNode, true);
          nodes.push({ 
            id: targetNode, 
            label: targetNode,
            group: 2
          });
        }
        
        // Add link
        links.push({
          source: sourceNode,
          target: targetNode,
          type: relation,
          value: 1
        });
      } else {
        // If no pattern match, just create connected nodes from lines
        if (index > 0) {
          const prevNodeId = `text-${index-1}`;
          const currNodeId = `text-${index}`;
          
          // Add nodes
          if (!nodeMap.has(prevNodeId)) {
            nodeMap.set(prevNodeId, true);
            nodes.push({ 
              id: prevNodeId, 
              label: textData[index-1].substring(0, 15) + (textData[index-1].length > 15 ? '...' : ''),
              group: index % 5
            });
          }
          
          if (!nodeMap.has(currNodeId)) {
            nodeMap.set(currNodeId, true);
            nodes.push({ 
              id: currNodeId, 
              label: line.substring(0, 15) + (line.length > 15 ? '...' : ''),
              group: (index + 1) % 5
            });
          }
          
          // Add link
          links.push({
            source: prevNodeId,
            target: currNodeId,
            value: 1
          });
        } else if (index === 0 && textData.length > 0) {
          // Just add the first node
          const nodeId = `text-0`;
          nodeMap.set(nodeId, true);
          nodes.push({ 
            id: nodeId, 
            label: line.substring(0, 15) + (line.length > 15 ? '...' : ''),
            group: 0
          });
        }
      }
    });
    
    setGraphData({ nodes, links });
  };

  if (!titleColor) return null;

  return (
    <>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-xxl text-center">
          <span className={title()}>This is the</span>
          <br />
          <span className={title({ color: titleColor as any })}>Applied Visual Analytics 2025&nbsp;</span>
          <br />
          <span className={title()}>development template.</span>
          <div className={subtitle({ class: "mt-4" })}>
            Maintained by{" "}
            <a className="text-primary" href="mailto:lucas.joos@uni-konstanz.de">
              Lucas Joos
            </a>
            .
          </div>
          <div className="mt-3">
            Change the theme:
            <br />
            <ThemeSwitch />
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Card className="w-[400px]">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md">Neo4J Database</p>
              <p className="text-small text-default-500">Write Data</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <Button
              isLoading={dbWriteStatus === QueryStatus.Loading}
              onPress={writeData}
              color="primary"
            >
              Press to write to database...
            </Button>
            <Alert
              isVisible={dbWriteStatus === QueryStatus.Success || dbWriteStatus === QueryStatus.Failure}
              color={dbWriteStatus === QueryStatus.Success ? "success" : "danger"}
              className="mt-3"
              title={dbWriteStatus === QueryStatus.Success ? "Success" : "Failure"}
              description={dbWriteInfo}
            />
          </CardBody>
        </Card>

        <Card className="mt-10 w-full max-w-3xl">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md">Neo4J Database</p>
              <p className="text-small text-default-500">Read Data & Visualize</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <Button
              isLoading={dbReadStatus === QueryStatus.Loading}
              onPress={readData}
              color="primary"
            >
              Press to read from database...
            </Button>
            <Alert
              isVisible={dbReadStatus === QueryStatus.Success || dbReadStatus === QueryStatus.Failure}
              color={dbReadStatus === QueryStatus.Success ? "success" : "danger"}
              className="mt-3"
              title={dbReadStatus === QueryStatus.Success ? "Success" : "Failure"}
              description={dbReadInfo}
            />
            
            {/* Display raw data */}
            {dbReadText && dbReadStatus === QueryStatus.Success && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold">Raw Data from DB:</h3>
                <div className="bg-default-100 p-3 rounded-md mt-2 overflow-auto max-h-40">
                  {dbReadText}
                </div>
              </div>
            )}
            
            {/* D3 Network Graph Visualization */}
            {graphData.nodes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Network Graph Visualization:</h3>
                <div 
                  ref={graphContainerRef} 
                  className="mt-2 border rounded-md overflow-hidden" 
                  style={{ height: '500px', width: '100%' }}
                >
                  <svg ref={svgRef} className="w-full h-full"></svg>
                </div>
                <div className="text-xs text-default-500 mt-2">
                  Tip: Drag nodes to reposition. Scroll to zoom, drag background to pan.
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </>
  );
}