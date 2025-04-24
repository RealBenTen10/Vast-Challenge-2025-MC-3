"use client";

import { title, subtitle } from "@/components/primitives";
import { ThemeSwitch } from "@/components/theme-switch";
import { Card, CardHeader, CardBody, Divider, Button, Alert } from "@heroui/react";
import React, { ReactElement, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Lazy load Graph to avoid SSR issues with D3
const Graph = dynamic(() => import("./graph"), { ssr: false });

enum QueryStatus {
  None,
  Loading,
  Success,
  Failure,
}

export default function Home() {
  const [dbWriteStatus, setDbWriteStatus] = useState<QueryStatus>(QueryStatus.None);
  const [dbWriteInfo, setDbWriteInfo] = useState("");
  const [dbReadStatus, setDbReadStatus] = useState<QueryStatus>(QueryStatus.None);
  const [dbReadText, setDbReadText] = useState<ReactElement | null>(null);
  const [dbReadInfo, setDbReadInfo] = useState("");
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);
  const [titleColor, setTitleColor] = useState("");

  const titleColorArray = ["yellow", "green", "blue", "violet", "cyan", "pink"];

  useEffect(() => {
    if (!titleColor) {
      const randomColor = titleColorArray[Math.floor(Math.random() * titleColorArray.length)];
      setTitleColor(randomColor);
    }
  }, [titleColor]);

  const writeData = async () => {
    setDbWriteStatus(QueryStatus.Loading);
    try {
      const response = await fetch("/api/start_loading");
      if (!response.ok) throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      const result = await response.json();

      if (result.success) {
        setDbWriteStatus(QueryStatus.Success);
        setDbWriteInfo("The database will be filled with data!");
      } else {
        setDbWriteStatus(QueryStatus.Failure);
        setDbWriteInfo(`Writing database failed: ${result["error-message"]}`);
      }
    } catch (error) {
      setDbWriteStatus(QueryStatus.Failure);
      setDbWriteInfo(`Writing database failed: ${error}`);
    }
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

  const fetchGraphData = async () => {
    try {
      const response = await fetch("/api/graph-data");
      const result = await response.json();
      if (result.success) {
        setGraphData({ nodes: result.nodes, links: result.links });
      }
    } catch (error) {
      console.error("Graph data fetch failed:", error);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

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

        <Card className="mt-10 w-[400px]">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md">Neo4J Database</p>
              <p className="text-small text-default-500">Read Data</p>
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
            {dbReadText && dbReadStatus === QueryStatus.Success && (
              <div className="mt-4">
                <b>Retrieved from DB:</b>
                <p>{dbReadText}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      {graphData && (
        <section className="py-10 flex justify-center">
          <div className="w-full max-w-6xl h-[600px]">
            <Graph nodes={graphData.nodes} links={graphData.links} />
          </div>
        </section>
      )}
    </>
  );
}
