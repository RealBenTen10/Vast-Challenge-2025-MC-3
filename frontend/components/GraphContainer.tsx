"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody, Divider, Button, Alert } from "@heroui/react";

interface EntityGroupingProps {
  onGroupCreated: (newNode: any, newEdges: any[]) => void;
}

export default function EntityGrouping({ onGroupCreated }: EntityGroupingProps) {
  const [statusMsg, setStatusMsg] = useState<string>("");

  const groupEntities = async () => {
    const groupId = prompt("Group ID:");
    const entityIds = prompt("Entity IDs (comma-separated):");
    if (!groupId || !entityIds) return;

    try {
      const res = await fetch(
        `/api/group-by?group_id=${encodeURIComponent(groupId)}&entity_ids=${encodeURIComponent(entityIds)}`
      );
      const data = await res.json();
      if (data.success) {
        onGroupCreated(data.group_node, data.group_edges);
        setStatusMsg(`Group ${groupId} created.`);
      } else {
        setStatusMsg("Grouping failed.");
      }
    } catch (err) {
      setStatusMsg(`Error during grouping: ${err}`);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <h3 className="text-lg">Entity Grouping</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        <Button onPress={groupEntities} color="secondary">
          Group Entities
        </Button>
        <Alert
          isVisible={!!statusMsg}
          color="info"
          title="Status"
          description={statusMsg}
          className="mt-2"
        />
      </CardBody>
    </Card>
  );
}
