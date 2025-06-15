'use client';
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';
import { GraphData, Node, Link } from '../types';
import { getVisibleNodeIds } from './getVisibleNodeIds';

interface DrawGraphProps {
  graphData: GraphData;
  filterEntityId: string;
  filterDepth: number;
  filterContent: string;
  selectedTimestamp: string | null;
}

export default function DrawGraph({
  graphData,
  filterEntityId,
  filterDepth,
  filterContent,
  selectedTimestamp,
}: DrawGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current?.clientWidth || 800;
    const height = svgRef.current?.clientHeight || 600;

    const visibleNodeIds = getVisibleNodeIds(
      graphData,
      filterEntityId,
      filterDepth,
      filterContent,
      selectedTimestamp
    );

    const filteredNodes = graphData.nodes.filter(n => visibleNodeIds.has(n.id));
    const filteredLinks = graphData.links.filter(
      l =>
        visibleNodeIds.has(typeof l.source === 'string' ? l.source : l.source.id) &&
        visibleNodeIds.has(typeof l.target === 'string' ? l.target : l.target.id)
    );

    const simulation = d3.forceSimulation<Node>(filteredNodes)
      .force('link', d3.forceLink<Link, Node>(filteredLinks).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value || 1));

    const node = svg
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(filteredNodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', d => (d.type === 'Event' ? '#f39c12' : '#3498db'))
      .call(drag(simulation));

    node.append('title').text(d => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', d => getX(d.source))
        .attr('y1', d => getY(d.source))
        .attr('x2', d => getX(d.target))
        .attr('y2', d => getY(d.target));

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);
    });

    function getX(d: string | Node) {
      return typeof d === 'string' ? 0 : d.x!;
    }

    function getY(d: string | Node) {
      return typeof d === 'string' ? 0 : d.y!;
    }

    function drag(sim: d3.Simulation<Node, Link>) {
      return d3.drag<SVGCircleElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }

    return () => simulation.stop();
  }, [graphData, filterEntityId, filterDepth, filterContent, selectedTimestamp]);

  return <svg ref={svgRef} width="100%" height="600px" />;
}
