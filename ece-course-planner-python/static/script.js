let graphData = null;
let simulation;

// Fetch courses from the API
function fetchCourses(category = null) {
    const url = category ? `/api/courses/${encodeURIComponent(category)}` : '/api/courses';
    fetch(url)
        .then(response => response.json())
        .then(data => {
            graphData = data;
            console.log('Graph Data:', graphData);
            updateVisualization();
            updateCourseList(data.nodes);
        });
}

function filterCourses(category) {
    // Log the category being filtered
    console.log('Filtering by category:', category);
    
    // Fetch courses with the selected category
    fetchCourses(category);
    
    // Update filter button styles
    document.querySelectorAll('#category-filters button').forEach(button => {
        // Reset all buttons first
        button.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300';
        button.style.backgroundColor = '';
        
        // Check if this button is selected
        if (category === null && button.textContent.trim() === 'All Courses') {
            // All Courses button
            button.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-white';
        } else if (category !== null) {
            // Special case for Software Engineering
            if (category === 'Software Engineering' && button.textContent.trim() === 'Software Engineering') {
                button.className = 'px-4 py-2 rounded-full text-sm font-semibold text-white';
                let categoryColor = button.getAttribute('data-color') || '#16a34a';
                button.style.backgroundColor = categoryColor;
            } 
            // Check if this button's data-category matches the selected category
            else {
                const buttonCategory = button.getAttribute('data-category');
                if (buttonCategory === category) {
                    // This is the selected category button
                    button.className = 'px-4 py-2 rounded-full text-sm font-semibold text-white';
                    let categoryColor = button.getAttribute('data-color') || categoryColors[buttonCategory] || '#858585';
                    button.style.backgroundColor = categoryColor;
                }
            }
        }
    });
}

function initializeVisualization() {
    const width = document.getElementById('graph').clientWidth;
    const height = document.getElementById('graph').clientHeight;
    
    const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    const g = svg.append('g');
    
    // Create specific groups to control drawing order
    g.append('g').attr('class', 'links-group'); // Links go in this group (drawn first)
    g.append('g').attr('class', 'nodes-group'); // Nodes go in this group (drawn last)
    
    // Add click event on the background to reset highlights
    svg.on('click', function(event) {
        // Only reset if the click is directly on the SVG background, not on a node
        if (event.target.tagName === 'svg') {
            resetHighlights();
            
            // Also close the details panel if it's open
            const detailsPanel = document.getElementById('course-details');
            if (detailsPanel) {
                detailsPanel.style.transform = 'translateX(100%)';
            }
        }
    });
    
    simulation = d3.forceSimulation()
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(60))
        .force('link', d3.forceLink().id(d => d.id).distance(120));
    
    fetchCourses();
}

function updateVisualization() {
    if (!graphData) return;

    // Get the specific groups for links and nodes
    const linksGroup = d3.select('#graph g .links-group');
    const nodesGroup = d3.select('#graph g .nodes-group');
    
    // Update links - these will be drawn first (behind)
    const link = linksGroup.selectAll('.link')
        .data(graphData.links, d => `${d.source}-${d.target}`);
    
    link.exit().remove();
    
    const linkEnter = link.enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 2)
        .attr('data-type', d => d.type)
        .attr('data-source', d => typeof d.source === 'object' ? d.source.id : d.source)
        .attr('data-target', d => typeof d.target === 'object' ? d.target.id : d.target);
    
    // Update nodes - these will be drawn last (in front)
    const node = nodesGroup.selectAll('.node')
        .data(graphData.nodes, d => d.id);
    
    node.exit().remove();
    
    const nodeEnter = node.enter()
        .append('g')
        .attr('class', 'node')
        .attr('data-id', d => d.id)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    nodeEnter.append('circle')
        .attr('r', 30)
        .style('fill', d => categoryColors[d.category])
        .style('cursor', 'pointer');
    
    nodeEnter.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 5)
        .attr('pointer-events', 'none')
        .text(d => d.id);
    
    // Only keep click functionality, hover removed
    nodeEnter
        .on('click', function(event, d) {
            showCourseDetails(d.id);
        });
    
    // Update simulation
    simulation
        .nodes(graphData.nodes)
        .force('link')
        .links(graphData.links);
    
    simulation.on('tick', () => {
        d3.select('#graph g .links-group').selectAll('.link')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        d3.select('#graph g .nodes-group').selectAll('.node')
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    simulation.alpha(1).restart();
}

function updateCourseList(courses) {
    const courseList = document.getElementById('course-list');
    courseList.innerHTML = `
        <h2 class="text-xl font-bold mb-4">${
            courses.length === graphData.nodes.length ? 'All Courses' : 'Filtered Courses'
        }</h2>
        <div class="space-y-2">
            ${courses.map(course => `
                <div class="course-item" style="border-color: ${categoryColors[course.category] || '#858585'}" 
                     data-id="${course.id}" onclick="showCourseDetails('${course.id}')">
                    <h3 class="font-semibold">${course.id}</h3>
                    <p class="text-sm text-gray-600">${course.name || 'Non-EECE Course'}</p>
                    <div class="mt-2 flex items-center gap-2">
                        <span class="category-badge" style="background-color: ${categoryColors[course.category] || '#858585'}">
                            ${course.category.split('/')[0]}
                        </span>
                        ${course.credits ? `
                        <span class="text-xs text-gray-500">
                            ${course.credits} ${course.credits === 1 ? 'Credit' : 'Credits'}
                        </span>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Add click event listeners to course items
    document.querySelectorAll('.course-item').forEach(item => {
        item.style.cursor = 'pointer';
    });
}

function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

// Functions for highlighting connections and showing course details
function highlightConnections(courseId) {
    // Dim all nodes and links first
    d3.select('#graph g .nodes-group').selectAll('.node circle').style('opacity', 0.3);
    d3.select('#graph g .links-group').selectAll('.link').style('opacity', 0.1);
    
    // Highlight the selected node
    d3.select('#graph g .nodes-group').selectAll(`.node[data-id="${courseId}"] circle`).style('opacity', 1);
    
    // Helper function to get the actual ID from a link source/target
    // D3.js might convert these to objects during simulation
    function getLinkNodeId(linkEnd) {
        return typeof linkEnd === 'object' ? linkEnd.id : linkEnd;
    }
    
    // In the backend (app.py), the connections are set up as:
    // Edge: dependency -> course (prereq/coreq)
    // This means the dependency is the source and the course is the target
    
    // Find prerequisites - courses that this course requires
    // These are links where this course is the target and the prereq courses are the sources
    const prereqs = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'prerequisite';
    });
    
    prereqs.forEach(link => {
        const sourceId = getLinkNodeId(link.source);
        d3.select('#graph g .nodes-group').selectAll(`.node[data-id="${sourceId}"] circle`).style('opacity', 1);
        // Use the actual IDs for data attributes
        d3.select('#graph g .links-group').selectAll(`.link[data-source="${sourceId}"][data-target="${courseId}"]`).style('opacity', 1);
    });
    
    // Find corequisites - courses that this course requires as coreqs
    const coreqs = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'corequisite';
    });
    
    coreqs.forEach(link => {
        const sourceId = getLinkNodeId(link.source);
        d3.select('#graph g .nodes-group').selectAll(`.node[data-id="${sourceId}"] circle`).style('opacity', 1);
        d3.select('#graph g .links-group').selectAll(`.link[data-source="${sourceId}"][data-target="${courseId}"]`).style('opacity', 1);
    });
    
    // Find courses that require this course as a prerequisite or corequisite
    // These are links where this course is the source and the dependent courses are the targets
    const requiredBy = graphData.links.filter(link => {
        const sourceId = getLinkNodeId(link.source);
        return sourceId === courseId;
    });
    
    requiredBy.forEach(link => {
        const targetId = getLinkNodeId(link.target);
        d3.select('#graph g .nodes-group').selectAll(`.node[data-id="${targetId}"] circle`).style('opacity', 1);
        d3.select('#graph g .links-group').selectAll(`.link[data-source="${courseId}"][data-target="${targetId}"]`).style('opacity', 1);
    });
}

function resetHighlights() {
    d3.select('#graph g .nodes-group').selectAll('.node circle').style('opacity', 1);
    d3.select('#graph g .links-group').selectAll('.link').style('opacity', 0.6);
}

function showCourseDetails(courseId) {
    // Find the course in graphData
    const course = graphData.nodes.find(node => node.id === courseId);
    if (!course) return;
    
    console.log('Showing details for course:', courseId);
    console.log('All links:', graphData.links);
    
    // Helper function to get the actual ID from a link source/target
    // D3.js might convert these to objects during simulation
    function getLinkNodeId(linkEnd) {
        return typeof linkEnd === 'object' ? linkEnd.id : linkEnd;
    }
    
    // In the backend (app.py), the connections are set up as:
    // Edge: dependency -> course (prereq/coreq)
    // This means the dependency is the source and the course is the target
    
    // Find prerequisites - courses that this course requires
    // These are links where this course is the target and the prereq courses are the sources
    const prereqLinks = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'prerequisite';
    });
    console.log('Prerequisite links:', prereqLinks);
    
    const prereqs = prereqLinks.map(link => {
        const sourceId = getLinkNodeId(link.source);
        const prereqNode = graphData.nodes.find(node => node.id === sourceId);
        console.log('Found prereq node:', prereqNode);
        return prereqNode;
    }).filter(Boolean); // Remove any undefined values
    
    // Find corequisites - courses that this course requires as coreqs
    const coreqLinks = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'corequisite';
    });
    console.log('Corequisite links:', coreqLinks);
    
    const coreqs = coreqLinks.map(link => {
        const sourceId = getLinkNodeId(link.source);
        const coreqNode = graphData.nodes.find(node => node.id === sourceId);
        console.log('Found coreq node:', coreqNode);
        return coreqNode;
    }).filter(Boolean); // Remove any undefined values
    
    // Find courses that require this course as a prerequisite or corequisite
    // These are links where this course is the source and the dependent courses are the targets
    const requiredByLinks = graphData.links.filter(link => {
        const sourceId = getLinkNodeId(link.source);
        return sourceId === courseId;
    });
    console.log('Required by links:', requiredByLinks);
    
    const requiredByPrereqLinks = requiredByLinks.filter(link => link.type === 'prerequisite');
    const requiredByPrereq = requiredByPrereqLinks.map(link => {
        const targetId = getLinkNodeId(link.target);
        const reqNode = graphData.nodes.find(node => node.id === targetId);
        console.log('Found required by (prereq) node:', reqNode);
        return reqNode;
    }).filter(Boolean); // Remove any undefined values
    
    const requiredByCoreqLinks = requiredByLinks.filter(link => link.type === 'corequisite');
    const requiredByCoreq = requiredByCoreqLinks.map(link => {
        const targetId = getLinkNodeId(link.target);
        const reqNode = graphData.nodes.find(node => node.id === targetId);
        console.log('Found required by (coreq) node:', reqNode);
        return reqNode;
    }).filter(Boolean); // Remove any undefined values

    // Create or get the details panel
    let detailsPanel = document.getElementById('course-details');
    if (!detailsPanel) {
        detailsPanel = document.createElement('div');
        detailsPanel.id = 'course-details';
        detailsPanel.className = 'fixed top-0 right-0 h-full w-80 bg-white shadow-lg p-6 transform transition-transform duration-300 z-50';
        detailsPanel.style.transform = 'translateX(100%)';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'absolute top-4 right-4 text-2xl font-bold';
        closeBtn.onclick = () => {
            detailsPanel.style.transform = 'translateX(100%)';
            resetHighlights();
        };
        detailsPanel.appendChild(closeBtn);
        
        document.body.appendChild(detailsPanel);
    }
    
    // Update panel content
    detailsPanel.innerHTML = `
        <button class="absolute top-4 right-4 text-2xl font-bold">&times;</button>
        <h2 class="text-2xl font-bold mb-2">${course.id}</h2>
        <h3 class="text-xl mb-4">${course.name || 'Non-EECE Course'}</h3>
        
        <div class="mb-4">
            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold" 
                  style="background-color: ${categoryColors[course.category] || '#858585'}; color: white;">
                ${course.category}
            </span>
            ${course.credits ? `<span class="ml-2 text-gray-600">${course.credits} credits</span>` : ''}
        </div>
        
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="font-semibold mb-2">Description:</h4>
            <p class="text-sm text-gray-700">${course.description || 'No description available'}</p>
        </div>
        
        <div class="mt-6">
            <h4 class="font-bold mb-2">Prerequisites:</h4>
            ${prereqs.length > 0 ? `
                <ul class="list-disc pl-5 mb-4">
                    ${prereqs.map(p => `
                        <li class="mb-1">
                            <span class="font-semibold">${p.id}</span> - ${p.name || 'Non-EECE Course'}
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="text-gray-500 mb-4">None</p>'}
            
            <h4 class="font-bold mb-2">Corequisites:</h4>
            ${coreqs.length > 0 ? `
                <ul class="list-disc pl-5 mb-4">
                    ${coreqs.map(c => `
                        <li class="mb-1">
                            <span class="font-semibold">${c.id}</span> - ${c.name || 'Non-EECE Course'}
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="text-gray-500 mb-4">None</p>'}
            
            <h4 class="font-bold mb-2">Required By (as Prerequisite):</h4>
            ${requiredByPrereq.length > 0 ? `
                <ul class="list-disc pl-5 mb-4">
                    ${requiredByPrereq.map(p => `
                        <li class="mb-1">
                            <span class="font-semibold">${p.id}</span> - ${p.name || 'Non-EECE Course'}
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="text-gray-500 mb-4">None</p>'}
            
            <h4 class="font-bold mb-2">Required By (as Corequisite):</h4>
            ${requiredByCoreq.length > 0 ? `
                <ul class="list-disc pl-5">
                    ${requiredByCoreq.map(c => `
                        <li class="mb-1">
                            <span class="font-semibold">${c.id}</span> - ${c.name || 'Non-EECE Course'}
                        </li>
                    `).join('')}
                </ul>
            ` : '<p class="text-gray-500">None</p>'}
        </div>
    `;
    
    // Show the panel
    detailsPanel.style.transform = 'translateX(0)';
    
    // Add close button functionality
    detailsPanel.querySelector('button').onclick = () => {
        detailsPanel.style.transform = 'translateX(100%)';
        resetHighlights();
    };
    
    // Highlight connections in the graph
    highlightConnections(courseId);
}

// Initialize the visualization when the page loads
document.addEventListener('DOMContentLoaded', initializeVisualization);

const categoryColors = {
    "Electrical Engineering/Hardware": "#2563eb",
    "Software Engineering": "#16a34a",
    "Embedded/Firmware Engineering": "#9333ea",
    "General/Uncategorized": "#64748b",
    "NonEECE": "#858585"
};
