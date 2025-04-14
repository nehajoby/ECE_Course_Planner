import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { categoryColors } from '../data/courses';

const CourseGraph = ({ courses, selectedCategory }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!courses || courses.length === 0) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up the SVG
    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create a zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create a container for the graph
    const g = svg.append('g');

    // Filter courses based on selected category
    const filteredCourses = selectedCategory
      ? courses.filter(course => course.category === selectedCategory)
      : courses;

    // Create nodes for each course
    const nodes = filteredCourses.map(course => ({
      id: course.code,
      ...course
    }));

    // Create the force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Create the nodes
    const node = g.selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles for the nodes
    node.append('circle')
      .attr('r', 30)
      .style('fill', d => categoryColors[d.category])
      .style('stroke', '#fff')
      .style('stroke-width', 2);

    // Add text labels
    node.append('text')
      .text(d => d.code)
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .style('fill', 'white')
      .style('font-size', '10px');

    // Update node positions on each tick
    simulation.on('tick', () => {
      node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [courses, selectedCategory]);

  return (
    <div className="w-full h-full overflow-hidden bg-white rounded-lg shadow-lg">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default CourseGraph;
