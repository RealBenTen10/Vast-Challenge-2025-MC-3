export interface Node {
  id: string;
  label: string;
  type?: string;
  group?: number;
  degree?: number;
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