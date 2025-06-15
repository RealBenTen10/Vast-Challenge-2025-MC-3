import { GraphData } from '../types';

export function getVisibleNodeIds(
  graphData: GraphData,
  filterEntityId: string,
  filterDepth: number,
  filterContent: string,
  selectedTimestamp: string | null
): Set<string> {
  let visible = new Set<string>();

  // Entity Filter + Depth
  if (filterEntityId) {
    const queue = [filterEntityId];
    let level = 0;

    while (queue.length > 0 && level <= filterDepth) {
      const nextQueue: string[] = [];
      for (const id of queue) {
        if (visible.has(id)) continue;
        visible.add(id);

        const neighbors = graphData.links
          .filter(link => {
            const src = typeof link.source === "string" ? link.source : link.source.id;
            const tgt = typeof link.target === "string" ? link.target : link.target.id;
            return src === id || tgt === id;
          })
          .map(link => {
            const src = typeof link.source === "string" ? link.source : link.source.id;
            const tgt = typeof link.target === "string" ? link.target : link.target.id;
            return src === id ? tgt : src;
          });

        nextQueue.push(...neighbors);
      }
      queue.length = 0;
      queue.push(...nextQueue);
      level++;
    }
  } else {
    graphData.nodes.forEach(node => visible.add(node.id));
  }

  // Content Filter
  if (filterContent && filterContent.trim() !== "") {
    const contentLower = filterContent.toLowerCase();
    const relevantEvents = new Set<string>();

    graphData.nodes.forEach(node => {
      if (node.type === "Event") {
        const fields = ["content", "findings", "results", "destination", "outcome", "reference"];
        for (const field of fields) {
          if (node[field] && String(node[field]).toLowerCase().includes(contentLower)) {
            relevantEvents.add(node.id);
            break;
          }
        }
      }
    });

    const connectedEntities = new Set<string>();
    graphData.links.forEach(link => {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      if (relevantEvents.has(src) && graphData.nodes.find(n => n.id === tgt)?.type === "Entity") connectedEntities.add(tgt);
      if (relevantEvents.has(tgt) && graphData.nodes.find(n => n.id === src)?.type === "Entity") connectedEntities.add(src);
    });

    visible = new Set(
      Array.from(visible).filter(id => {
        const node = graphData.nodes.find(n => n.id === id);
        if (!node) return false;
        if (node.type === "Entity") return connectedEntities.has(id);
        if (node.type === "Event") return relevantEvents.has(id);
        return true;
      })
    );
  }

  // Timestamp Filter (applies only to Events, keeps all Entities/Relationships)
  if (selectedTimestamp && selectedTimestamp.trim() !== "") {

    visible = new Set(
      Array.from(visible).filter(id => {
        const node = graphData.nodes.find(n => n.id === id);
        if (!node) return true;
        if (node.type === "Event") return node.timestamp?.startsWith(selectedTimestamp);
        return true; // Entities/Relationships always kept
      })
    );
  }

  return visible;
}