"use client";

import React from "react";
import { Button } from "@heroui/react";

interface EntityGroupingProps {
  groupId: string;
  groupMembers: string;
  onGroupIdChange: (value: string) => void;
  onGroupMembersChange: (value: string) => void;
  onGroup: () => Promise<void>;
}

export default function EntityGrouping({
  groupId,
  groupMembers,
  onGroupIdChange,
  onGroupMembersChange,
  onGroup
}: EntityGroupingProps) {
  return (
    <div className="mt-6">
      <label className="text-sm font-medium">Entity Grouping:</label>
      <input
        className="mt-1 block w-full border rounded px-2 py-1 text-sm"
        type="text"
        value={groupId}
        onChange={e => onGroupIdChange(e.target.value)}
        placeholder="Group-ID (z.B. Musicians)"
      />
      <input
        className="mt-2 block w-full border rounded px-2 py-1 text-sm"
        type="text"
        value={groupMembers}
        onChange={e => onGroupMembersChange(e.target.value)}
        placeholder="Entities (z.B. Boss,The Lookout)"
      />
      <Button onClick={onGroup} className="mt-2" color="success">
        Create Entity Group
      </Button>
    </div>
  );
}
