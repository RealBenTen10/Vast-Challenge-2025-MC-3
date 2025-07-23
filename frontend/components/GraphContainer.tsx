import React, { MutableRefObject } from "react";

interface GraphContainerProps {
  svgRef: MutableRefObject<SVGSVGElement | null>;
  graphContainerRef: MutableRefObject<HTMLDivElement | null>;
}

const GraphContainer: React.FC<GraphContainerProps> = ({ svgRef, graphContainerRef }) => {
  return (
    <div ref={graphContainerRef} className="flex-1 border rounded-lg mt-6" style={{ height: "600px", width: "100%" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default GraphContainer;