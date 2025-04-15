let graphData = null;
let simulation;

// Track which courses have been added to the plan
let selectedCourses = new Set();

// Track which courses should be visible in the graph
let visibleCourses = new Set();

// Track which nodes have been manually positioned by the user
let manuallyPositionedNodes = new Set();

// Define drag behavior functions
function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    
    // Store the initial position
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    
    // Keep nodes fixed where they were dragged
    event.subject.fx = event.x;
    event.subject.fy = event.y;
    
    // Add this node to the set of manually positioned nodes
    manuallyPositionedNodes.add(event.subject.id);
    console.log(`Node ${event.subject.id} was manually positioned at (${event.x}, ${event.y})`);
}

// Helper function to get course level (1000s, 2000s, etc.) from course ID
function getCourseLevel(courseId) {
    // Extract the course number from the ID (e.g., 'EECE 2140' -> 2000)
    const match = courseId.match(/\d{4}/);
    if (match) {
        const courseNum = parseInt(match[0]);
        return Math.floor(courseNum / 1000) * 1000;
    }
    // For non-standard course IDs, default to middle level
    return 3000;
}

// Define mandatory courses that should be visible by default
const mandatoryCourses = [
    'GE 1501',   // Cornerstone of Engineering 1
    'GE 1502',   // Cornerstone of Engineering 2
    'EECE 2140', // Computing Fundamentals for Engineers
    'EECE 2150', // Circuits and Signals: Biomedical Applications
    'EECE 2160'  // Embedded Design: Enabling Robotics
    // Capstone courses removed from mandatory list
];

// Define prerequisite logic for courses with complex prerequisite structures
// This helps determine which prerequisites to show in the graph
// 'AND': All prerequisites are required
// 'OR': Any one prerequisite is sufficient
// 'COMPLEX': Custom logic defined in the 'logic' field
const prerequisiteLogic = {
    'EECE 5644': { type: 'OR' },
    'EECE 5641': { 
        type: 'COMPLEX',
        logic: [
            { type: 'AND', courses: ['EECE 2540', { type: 'OR', courses: ['EECE 4534', 'EECE 3324'] }] },
            { type: 'AND', courses: ['CS 3650', { type: 'OR', courses: ['CS 3700', 'EECE 2540'] }] },
            { type: 'AND', courses: ['EECE 7205', { type: 'OR', courses: ['EECE 7376', 'CS 5600'] }] }
        ]
    },
    'EECE 2150': {
        type: 'COMPLEX',
        logic: {
            type: 'AND',
            courses: [
                { type: 'OR', courses: ['GE 1111', 'GE 1502'] },
                'MATH 2341', 'PHYS 1155', 'PHYS 1165', 'PHYS 1175', 'EECE 2140'
            ]
        }
    },
    'EECE 2531': {
        type: 'COMPLEX',
        logic: {
            type: 'AND',
            courses: [
                { type: 'OR', courses: ['BIOE 3210', 'EECE 2150', 'EECE 2210'] },
                'MATH 2321',
                { type: 'OR', courses: ['PHYS 1155', 'PHYS 1165', 'PHYS 1175'] }
            ]
        }
    },
    'EECE 5665': {
        type: 'COMPLEX',
        logic: {
            type: 'AND',
            courses: [
                { type: 'OR', courses: ['BIOE 3210', 'EECE 2150', 'EECE 2210'] },
                'EECE 2520', 'MATH 2341',
                { type: 'OR', courses: ['EECE 3468', 'MATH 3081'] }
            ]
        }
    },
    'EECE 5645': {
        type: 'COMPLEX',
        logic: {
            type: 'OR',
            courses: [
                {
                    type: 'AND',
                    courses: [
                        { type: 'OR', courses: ['MATH 3081', 'EECE 3468'] },
                        { type: 'OR', courses: ['EECE 2560', 'CS 3000', 'CS 4800'] }
                    ]
                },
                'EECE 5644', 'DS 5220', 'DS 5230'
            ]
        }
    },
    'EECE 4791': { type: 'OR' },
    'EECE 2530': {
        type: 'COMPLEX',
        logic: {
            type: 'AND',
            courses: [
                { type: 'OR', courses: ['EECE 2150', 'EECE 2210', 'BIOE 3210'] },
                'MATH 2321',
                { type: 'OR', courses: ['PHYS 1155', 'PHYS 1165', 'PHYS 1175'] }
            ]
        }
    }
};

// Fetch courses from the API
function fetchCourses(category = null) {
    // First, fetch all courses for the graph data if it's not already loaded
    if (graphData === null) {
        fetch('/api/courses')
            .then(response => response.json())
            .then(data => {
                graphData = data;
                console.log('Graph Data:', graphData);
                
                // Add mandatory courses to visible courses if this is the initial load
                if (visibleCourses.size === 0) {
                    // Helper function to get the actual ID from a link source/target
                    function getLinkNodeId(linkEnd) {
                        return typeof linkEnd === 'object' ? linkEnd.id : linkEnd;
                    }
                    
                    // Make mandatory courses visible by default
                    mandatoryCourses.forEach(courseId => {
                        // Check if the course exists in the data
                        const courseExists = data.nodes.some(node => node.id === courseId);
                        if (courseExists) {
                            visibleCourses.add(courseId);
                            // Also add to selected courses so they get the black border
                            selectedCourses.add(courseId);
                            
                            // Find prerequisites and make them visible
                            const prereqLinks = data.links.filter(link => {
                                const targetId = getLinkNodeId(link.target);
                                return targetId === courseId && link.type === 'prerequisite';
                            });
                            
                            // Use the prerequisite logic to determine which prerequisites to show
                            if (prerequisiteLogic[courseId]) {
                                console.log(`Using prerequisite logic for ${courseId}: ${prerequisiteLogic[courseId].type}`);
                                
                                if (prerequisiteLogic[courseId].type === 'OR') {
                                    // For OR relationships, show a limited number of prerequisites
                                    // Prioritize EECE courses over non-EECE courses
                                    const eeceCourses = prereqLinks.filter(link => {
                                        const sourceId = getLinkNodeId(link.source);
                                        return sourceId.startsWith('EECE');
                                    });
                                    
                                    // If we have EECE courses, show at most 3 of them
                                    if (eeceCourses.length > 0) {
                                        const limitedPrereqs = eeceCourses.slice(0, 3);
                                        console.log(`Showing ${limitedPrereqs.length} EECE prerequisites for ${courseId}`);
                                        limitedPrereqs.forEach(link => {
                                            const sourceId = getLinkNodeId(link.source);
                                            visibleCourses.add(sourceId);
                                        });
                                    } else {
                                        // If no EECE courses, show at most 2 prerequisites
                                        const limitedPrereqs = prereqLinks.slice(0, 2);
                                        console.log(`Showing ${limitedPrereqs.length} non-EECE prerequisites for ${courseId}`);
                                        limitedPrereqs.forEach(link => {
                                            const sourceId = getLinkNodeId(link.source);
                                            visibleCourses.add(sourceId);
                                        });
                                    }
                                } else if (prerequisiteLogic[courseId].type === 'COMPLEX') {
                                    // For complex relationships, show a representative subset
                                    // For now, we'll show one prerequisite from each OR group and all from AND groups
                                    const representativePrereqs = new Set();
                                    
                                    // Simple function to extract representative prerequisites from a logic structure
                                    function extractRepresentativePrereqs(logic) {
                                        if (typeof logic === 'string') {
                                            // This is a course ID
                                            representativePrereqs.add(logic);
                                        } else if (logic.type === 'OR') {
                                            // For OR groups, take the first course (if it exists)
                                            if (logic.courses && logic.courses.length > 0) {
                                                if (typeof logic.courses[0] === 'string') {
                                                    representativePrereqs.add(logic.courses[0]);
                                                } else {
                                                    extractRepresentativePrereqs(logic.courses[0]);
                                                }
                                            }
                                        } else if (logic.type === 'AND') {
                                            // For AND groups, take all courses
                                            if (logic.courses) {
                                                logic.courses.forEach(course => {
                                                    if (typeof course === 'string') {
                                                        representativePrereqs.add(course);
                                                    } else {
                                                        extractRepresentativePrereqs(course);
                                                    }
                                                });
                                            }
                                        }
                                    }
                                    
                                    // Extract representative prerequisites
                                    extractRepresentativePrereqs(prerequisiteLogic[courseId].logic);
                                    
                                    // Add the representative prerequisites to visible courses
                                    prereqLinks.forEach(link => {
                                        const sourceId = getLinkNodeId(link.source);
                                        if (representativePrereqs.has(sourceId)) {
                                            visibleCourses.add(sourceId);
                                        }
                                    });
                                    
                                    console.log(`Showing representative prerequisites for ${courseId}:`, Array.from(representativePrereqs));
                                } else {
                                    // Default to showing all prerequisites
                                    prereqLinks.forEach(link => {
                                        const sourceId = getLinkNodeId(link.source);
                                        visibleCourses.add(sourceId);
                                    });
                                }
                            } else {
                                // For courses without specific logic, show all prerequisites
                                prereqLinks.forEach(link => {
                                    const sourceId = getLinkNodeId(link.source);
                                    visibleCourses.add(sourceId);
                                });
                            }
                            
                            // Find corequisites and make them visible
                            const coreqLinks = data.links.filter(link => {
                                const targetId = getLinkNodeId(link.target);
                                return targetId === courseId && link.type === 'corequisite';
                            });
                            
                            coreqLinks.forEach(link => {
                                const sourceId = getLinkNodeId(link.source);
                                visibleCourses.add(sourceId);
                            });
                        }
                    });
                }
                
                // Update the visualization (which will only show visible courses)
                updateVisualization();
                
                // Now fetch the filtered courses for the course list
                fetchFilteredCourses(category);
            });
    } else {
        // Graph data is already loaded, just fetch filtered courses for the list
        fetchFilteredCourses(category);
    }
}

// Fetch filtered courses for the course list only
function fetchFilteredCourses(category = null) {
    const url = category ? `/api/courses/${encodeURIComponent(category)}` : '/api/courses';
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Update the course list with the filtered data
            updateCourseList(data.nodes);
        });
}

function filterCourses(category) {
    // Log the category being filtered
    console.log('Filtering by category:', category);
    
    // Only fetch filtered courses for the list, don't affect the graph
    fetchFilteredCourses(category);
    
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
    
    // Define drag behavior functions
    window.dragstarted = function(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    window.dragged = function(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    window.dragended = function(event) {
        if (!event.active) simulation.alphaTarget(0);
        // Keep nodes fixed where they were dragged
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
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
    
    // This function has been moved to the global scope
    
    simulation = d3.forceSimulation()
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(60))
        .force('link', d3.forceLink().id(d => d.id).distance(120))
        // Add a Y-positioning force based on course number level
        .force('y', d3.forceY().strength(0.1).y(d => {
            const level = getCourseLevel(d.id);
            // Map course levels to vertical positions
            // Lower course numbers (1000s) at the top, higher numbers at the bottom
            switch(level) {
                case 1000: return height * 0.2;  // 1000-level courses at the top
                case 2000: return height * 0.35; // 2000-level courses
                case 3000: return height * 0.5;  // 3000-level courses in the middle
                case 4000: return height * 0.65; // 4000-level courses
                case 5000: return height * 0.8;  // 5000-level courses at the bottom
                default: return height * 0.5;    // Default to middle
            }
        }));
    
    fetchCourses();
}

function updateVisualization() {
    if (!graphData) return;

    // Get the specific groups for links and nodes
    const linksGroup = d3.select('#graph g .links-group');
    const nodesGroup = d3.select('#graph g .nodes-group');
    
    // Filter visible links - only show links where both source and target are visible
    const visibleLinks = graphData.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return visibleCourses.has(sourceId) && visibleCourses.has(targetId);
    });
    
    // Update links - these will be drawn first (behind)
    const link = linksGroup.selectAll('.link')
        .data(visibleLinks, d => `${d.source}-${d.target}`);
    
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
    
    // Filter visible nodes
    const visibleNodes = graphData.nodes.filter(node => visibleCourses.has(node.id));
    
    // Update nodes - these will be drawn last (in front)
    const node = nodesGroup.selectAll('.node')
        .data(visibleNodes, d => d.id);
    
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
        .style('fill', d => categoryColors[d.category] || '#d3a4a4')
        .style('stroke', d => selectedCourses.has(d.id) ? '#000' : 'none')
        .style('stroke-width', d => selectedCourses.has(d.id) ? 3 : 0)
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
    
    // If in rearranged mode, maintain fixed positions
    if (isRearranged) {
        // Get graph dimensions
        const width = document.getElementById('graph').clientWidth;
        const height = document.getElementById('graph').clientHeight;
        
        // Make sure all visible nodes have fixed positions
        visibleNodes.forEach(node => {
            // If node doesn't have a fixed position yet, set it to current position
            if (node.fx === null || node.fy === null) {
                node.fx = node.x || width / 2;
                node.fy = node.y || height / 2;
            }
        });
        
        // Update the visualization without physics
        d3.select('#graph g .links-group').selectAll('.link')
            .attr('x1', d => d.source.x || d.source.fx)
            .attr('y1', d => d.source.y || d.source.fy)
            .attr('x2', d => d.target.x || d.target.fx)
            .attr('y2', d => d.target.y || d.target.fy);
        
        d3.select('#graph g .nodes-group').selectAll('.node')
            .attr('transform', d => `translate(${d.x || d.fx},${d.y || d.fy})`);
        
        // Minimal simulation just to update positions
        simulation
            .nodes(graphData.nodes)
            .force('link')
            .links(graphData.links);
        
        simulation.alpha(0).restart();
    } else {
        // Normal force-directed layout
        // Update simulation
        simulation
            .nodes(graphData.nodes)
            .force('link')
            .links(graphData.links);
        
        // Make sure the y-force is applied to maintain course level positioning
        // Reduced strength to allow collision avoidance to work better
        simulation.force('y', d3.forceY().strength(0.05).y(d => {
            const level = getCourseLevel(d.id);
            const height = document.getElementById('graph').clientHeight;
            // Map course levels to vertical positions
            // Lower course numbers (1000s) at the top, higher numbers at the bottom
            switch(level) {
                case 1000: return height * 0.2;  // 1000-level courses at the top
                case 2000: return height * 0.35; // 2000-level courses
                case 3000: return height * 0.5;  // 3000-level courses in the middle
                case 4000: return height * 0.65; // 4000-level courses
                case 5000: return height * 0.8;  // 5000-level courses at the bottom
                default: return height * 0.5;    // Default to middle
            }
        }));
        
        // Add much stronger collision force to completely prevent overlap
        // Increased radius, strength, and iterations for solid-like behavior
        simulation.force('collision', d3.forceCollide().radius(100).strength(1).iterations(20));
        
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
}

function updateCourseList(courses) {
    const courseList = document.getElementById('course-list');
    courseList.innerHTML = `
        <h2 class="text-xl font-bold mb-4">${
            courses.length === graphData.nodes.length ? 'All Courses' : 'Filtered Courses'
        }</h2>
        <div class="space-y-2">
            ${courses.map(course => `
                <div class="course-item ${selectedCourses.has(course.id) ? 'selected-course' : ''}" 
                     style="border-color: ${categoryColors[course.category] || '#858585'}; 
                            ${selectedCourses.has(course.id) ? 'background-color: rgba(59, 130, 246, 0.1);' : ''}" 
                     data-id="${course.id}" onclick="showCourseDetails('${course.id}')">
                    <h3 class="font-semibold">${course.id}</h3>
                    <p class="text-sm text-gray-600">${course.name || 'Non-EECE Course'}</p>
                    <div class="mt-2 flex items-center gap-2 justify-between">
                        <div class="flex items-center gap-2">
                            <span class="category-badge" style="background-color: ${categoryColors[course.category] || '#858585'}">
                                ${course.category.split('/')[0]}
                            </span>
                            ${course.credits ? `
                            <span class="text-xs text-gray-500">
                                ${course.credits} ${course.credits === 1 ? 'Credit' : 'Credits'}
                            </span>
                            ` : ''}
                        </div>
                        ${selectedCourses.has(course.id) ? 
                            `<span class="px-2 py-1 bg-red-100 text-[#b50c0c] text-xs rounded-full">In Plan</span>` : ''}
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

// Drag functions are defined at the top level

// Track if the graph is currently in rearranged mode
let isRearranged = false;

// Function to rearrange the graph in a more structured layout
function rearrangeGraph() {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;
    
    // Stop any ongoing simulation
    simulation.stop();
    
    // Set the rearranged flag
    isRearranged = true;
    
    // Group nodes by course level and category
    const nodesByLevelAndCategory = {};
    const visibleNodes = graphData.nodes.filter(node => visibleCourses.has(node.id));
    
    // Log which nodes have been manually positioned by the user
    if (manuallyPositionedNodes.size > 0) {
        console.log(`Preserving positions for ${manuallyPositionedNodes.size} manually positioned nodes:`);
        manuallyPositionedNodes.forEach(nodeId => {
            const node = graphData.nodes.find(n => n.id === nodeId);
            if (node) {
                console.log(`- ${nodeId} at (${node.fx}, ${node.fy})`);
            }
        });
    }
    
    // Reset positions for nodes that weren't manually positioned
    visibleNodes.forEach(node => {
        // Skip nodes that were manually positioned by the user
        if (manuallyPositionedNodes.has(node.id)) {
            console.log(`Preserving manual position for ${node.id} at (${node.fx}, ${node.fy})`);
            return;
        }
        
        // Clear any previous fixed positions for non-manually positioned nodes
        node.fx = null;
        node.fy = null;
        
        const level = getCourseLevel(node.id);
        const category = node.category || 'Other';
        
        if (!nodesByLevelAndCategory[level]) {
            nodesByLevelAndCategory[level] = {};
        }
        
        if (!nodesByLevelAndCategory[level][category]) {
            nodesByLevelAndCategory[level][category] = [];
        }
        
        nodesByLevelAndCategory[level][category].push(node);
    });
    
    // Get graph dimensions
    const width = document.getElementById('graph').clientWidth;
    const height = document.getElementById('graph').clientHeight;
    
    // Arrange nodes in a grid-like structure
    // Course levels are rows, categories are columns
    const levels = Object.keys(nodesByLevelAndCategory).sort();
    const rowHeight = height / (levels.length || 1);
    
    // Node radius plus buffer to prevent overlap
    const nodeSize = 70; // Increased from default to provide more space
    
    levels.forEach((level, levelIndex) => {
        const categories = Object.keys(nodesByLevelAndCategory[level]);
        const colWidth = width / (categories.length || 1);
        
        categories.forEach((category, categoryIndex) => {
            const nodes = nodesByLevelAndCategory[level][category];
            const nodeCount = nodes.length;
            
            // Skip if no nodes to arrange
            if (nodeCount === 0) return;
            
            // Arrange nodes in a grid within their category section
            const nodesPerRow = Math.ceil(Math.sqrt(nodeCount));
            
            // Calculate spacing to ensure no overlap
            // Use the larger of calculated spacing or minimum node size
            const minSpacingX = colWidth / (nodesPerRow + 1);
            const minSpacingY = rowHeight / (Math.ceil(nodeCount / nodesPerRow) + 1);
            const nodeSpacingX = Math.max(minSpacingX, nodeSize * 1.5);
            const nodeSpacingY = Math.max(minSpacingY, nodeSize * 1.5);
            
            nodes.forEach((node, nodeIndex) => {
                const row = Math.floor(nodeIndex / nodesPerRow);
                const col = nodeIndex % nodesPerRow;
                
                // Calculate position within the category section with buffer
                // Center the grid within the available space
                const sectionCenterX = (categoryIndex + 0.5) * colWidth;
                const sectionCenterY = (levelIndex + 0.5) * rowHeight;
                
                const gridWidth = nodesPerRow * nodeSpacingX;
                const gridHeight = Math.ceil(nodeCount / nodesPerRow) * nodeSpacingY;
                
                const startX = sectionCenterX - (gridWidth / 2) + (nodeSpacingX / 2);
                const startY = sectionCenterY - (gridHeight / 2) + (nodeSpacingY / 2);
                
                // Add horizontal staggering within rows
                const staggerX = (nodeIndex % 2) * (nodeSpacingX * 0.3);
                // Add vertical staggering to prevent nodes from being in a straight line
                const staggerY = ((nodeIndex % 3) - 1) * (nodeSpacingY * 0.3);
                
                const x = startX + (col * nodeSpacingX) + staggerX;
                const y = startY + (row * nodeSpacingY) + staggerY;
                
                // Set node position
                node.x = x;
                node.y = y;
                node.fx = x; // Fix position permanently until reset
                node.fy = y;
            });
        });
    });
    
    // Update the visualization
    d3.select('#graph g .nodes-group').selectAll('.node')
        .attr('transform', d => `translate(${d.x},${d.y})`);
    
    d3.select('#graph g .links-group').selectAll('.link')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    
    // Disable physics simulation
    simulation.alpha(0).restart();
}

// Function to reset the graph layout to the default force-directed layout
function resetLayout() {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;
    
    // Stop any ongoing simulation
    simulation.stop();
    
    // Reset the rearranged flag
    isRearranged = false;
    
    // Clear the set of manually positioned nodes
    manuallyPositionedNodes.clear();
    
    // Clear any fixed positions
    graphData.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
    });
    
    // Reset forces to original values
    simulation
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(document.getElementById('graph').clientWidth / 2, document.getElementById('graph').clientHeight / 2))
        .force('collision', d3.forceCollide().radius(60))
        .force('link', d3.forceLink().id(d => d.id).distance(120))
        .force('y', d3.forceY().strength(0.1).y(d => {
            const level = getCourseLevel(d.id);
            const height = document.getElementById('graph').clientHeight;
            // Map course levels to vertical positions
            switch(level) {
                case 1000: return height * 0.2;  // 1000-level courses at the top
                case 2000: return height * 0.35; // 2000-level courses
                case 3000: return height * 0.5;  // 3000-level courses in the middle
                case 4000: return height * 0.65; // 4000-level courses
                case 5000: return height * 0.8;  // 5000-level courses at the bottom
                default: return height * 0.5;    // Default to middle
            }
        }));
    
    // Restart simulation with higher alpha for more movement
    simulation.alpha(1).restart();
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

// Function to add a course to the plan
function addCourseToPlan(courseId) {
    // Add the course to the selected courses set
    selectedCourses.add(courseId);
    
    // Make this course visible in the graph
    visibleCourses.add(courseId);
    
    // Helper function to get the actual ID from a link source/target
    function getLinkNodeId(linkEnd) {
        return typeof linkEnd === 'object' ? linkEnd.id : linkEnd;
    }
    
    // Find prerequisites and make them visible
    const prereqLinks = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'prerequisite';
    });
    
    // Use the prerequisite logic to determine which prerequisites to show
    if (prerequisiteLogic[courseId]) {
        console.log(`Using prerequisite logic for ${courseId}: ${prerequisiteLogic[courseId].type}`);
        
        if (prerequisiteLogic[courseId].type === 'OR') {
            // For OR relationships, show a limited number of prerequisites
            // Prioritize EECE courses over non-EECE courses
            const eeceCourses = prereqLinks.filter(link => {
                const sourceId = getLinkNodeId(link.source);
                return sourceId.startsWith('EECE');
            });
            
            // If we have EECE courses, show at most 3 of them
            if (eeceCourses.length > 0) {
                const limitedPrereqs = eeceCourses.slice(0, 3);
                console.log(`Showing ${limitedPrereqs.length} EECE prerequisites for ${courseId}`);
                limitedPrereqs.forEach(link => {
                    const sourceId = getLinkNodeId(link.source);
                    visibleCourses.add(sourceId);
                });
            } else {
                // If no EECE courses, show at most 2 prerequisites
                const limitedPrereqs = prereqLinks.slice(0, 2);
                console.log(`Showing ${limitedPrereqs.length} non-EECE prerequisites for ${courseId}`);
                limitedPrereqs.forEach(link => {
                    const sourceId = getLinkNodeId(link.source);
                    visibleCourses.add(sourceId);
                });
            }
        } else if (prerequisiteLogic[courseId].type === 'COMPLEX') {
            // For complex relationships, show a representative subset
            // This is a simplified approach - in a full implementation, we would
            // traverse the logic structure and select appropriate prerequisites
            
            // For now, we'll show one prerequisite from each OR group and all from AND groups
            const representativePrereqs = new Set();
            
            // Simple function to extract representative prerequisites from a logic structure
            function extractRepresentativePrereqs(logic) {
                if (typeof logic === 'string') {
                    // This is a course ID
                    representativePrereqs.add(logic);
                } else if (logic.type === 'OR') {
                    // For OR groups, take the first course (if it exists)
                    if (logic.courses && logic.courses.length > 0) {
                        if (typeof logic.courses[0] === 'string') {
                            representativePrereqs.add(logic.courses[0]);
                        } else {
                            extractRepresentativePrereqs(logic.courses[0]);
                        }
                    }
                } else if (logic.type === 'AND') {
                    // For AND groups, take all courses
                    if (logic.courses) {
                        logic.courses.forEach(course => {
                            if (typeof course === 'string') {
                                representativePrereqs.add(course);
                            } else {
                                extractRepresentativePrereqs(course);
                            }
                        });
                    }
                }
            }
            
            // Extract representative prerequisites
            extractRepresentativePrereqs(prerequisiteLogic[courseId].logic);
            
            // Add the representative prerequisites to visible courses
            prereqLinks.forEach(link => {
                const sourceId = getLinkNodeId(link.source);
                if (representativePrereqs.has(sourceId)) {
                    visibleCourses.add(sourceId);
                }
            });
            
            console.log(`Showing representative prerequisites for ${courseId}:`, Array.from(representativePrereqs));
        } else {
            // Default to showing all prerequisites
            prereqLinks.forEach(link => {
                const sourceId = getLinkNodeId(link.source);
                visibleCourses.add(sourceId);
            });
        }
    } else {
        // For courses without specific logic, show all prerequisites
        prereqLinks.forEach(link => {
            const sourceId = getLinkNodeId(link.source);
            visibleCourses.add(sourceId);
        });
    }
    
    // Find corequisites and make them visible
    const coreqLinks = graphData.links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        return targetId === courseId && link.type === 'corequisite';
    });
    
    coreqLinks.forEach(link => {
        const sourceId = getLinkNodeId(link.source);
        visibleCourses.add(sourceId);
    });
    
    // Update the visualization
    updateVisualization();
    
    // Update the course list to reflect the changes
    updateCourseList(graphData.nodes);
    
    console.log('Added course to plan:', courseId);
    console.log('Selected courses:', Array.from(selectedCourses));
    console.log('Visible courses:', Array.from(visibleCourses));
}

// Function to remove a course from the plan
function removeCourseFromPlan(courseId) {
    // Remove the course from the selected courses set
    selectedCourses.delete(courseId);
    
    // Recalculate which courses should be visible
    // First, clear the visibleCourses set
    visibleCourses.clear();
    
    // Helper function to get the actual ID from a link source/target
    function getLinkNodeId(linkEnd) {
        return typeof linkEnd === 'object' ? linkEnd.id : linkEnd;
    }
    
    // Then add all selected courses and their prerequisites/corequisites
    selectedCourses.forEach(id => {
        // Add the selected course
        visibleCourses.add(id);
        
        // Add its prerequisites
        const prereqLinks = graphData.links.filter(link => {
            const targetId = getLinkNodeId(link.target);
            return targetId === id && link.type === 'prerequisite';
        });
        
        prereqLinks.forEach(link => {
            const sourceId = getLinkNodeId(link.source);
            visibleCourses.add(sourceId);
        });
        
        // Add its corequisites
        const coreqLinks = graphData.links.filter(link => {
            const targetId = getLinkNodeId(link.target);
            return targetId === id && link.type === 'corequisite';
        });
        
        coreqLinks.forEach(link => {
            const sourceId = getLinkNodeId(link.source);
            visibleCourses.add(sourceId);
        });
    });
    
    // Update the visualization
    updateVisualization();
    
    // Update the course list to reflect the changes
    updateCourseList(graphData.nodes);
    
    console.log('Removed course from plan:', courseId);
    console.log('Selected courses:', Array.from(selectedCourses));
    console.log('Visible courses:', Array.from(visibleCourses));
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
        
        <div class="mb-6">
            ${selectedCourses.has(course.id) ? 
                `<button id="remove-course-btn" class="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
                    Remove from Plan
                </button>` : 
                `<button id="add-course-btn" class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                    Add to Plan
                </button>`
            }
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
    
    // Add course button functionality
    const addCourseBtn = detailsPanel.querySelector('#add-course-btn');
    if (addCourseBtn) {
        addCourseBtn.onclick = () => {
            addCourseToPlan(course.id);
            // Update the details panel to show the Remove button
            showCourseDetails(course.id);
        };
    }
    
    // Remove course button functionality
    const removeCourseBtn = detailsPanel.querySelector('#remove-course-btn');
    if (removeCourseBtn) {
        removeCourseBtn.onclick = () => {
            removeCourseFromPlan(course.id);
            // Update the details panel to show the Add button
            showCourseDetails(course.id);
        };
    }
    
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
