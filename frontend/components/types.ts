export interface Node {
  id: string;
  label: string;
  type?: string;
  group?: number;
  degree?: number;
  sub_type?: string;
  timestamp?: string;
  content?: string;
  findings?: string;
  [key: string]: any;
}

export interface Link {
  source: string | Node;
  target: string | Node;
  type?: string;
  value?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface Props {
  graphData: { nodes: Node[]; links: Link[] };
  filterEntityId: string;
  filterDepth: number;
  filterContent: string;
  selectedTimestamp: string | null;
  filterMode: "all" | "event" | "relationship";
  setSelectedInfo: (info: any) => void;
  setVisibleEntities: (list: { id: string; sub_type?: string }[]) => void;
  setSubtypeCounts: (counts: Record<string, number>) => void;
  setEdgeTypeCounts: (counts: Record<string, number>) => void;
  setEdgeCount: (count: number) => void;
}