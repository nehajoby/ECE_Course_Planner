let courses = [];
let simulation;

// Fetch courses from the API
fetch('/api/courses')
    .then(response => response.json())
    .then(data => {
        courses = data;
        initializeGraph(courses);
        updateCourseList(courses);
    });

function filterCourses(category) {
    const filteredCourses = category 
        ? courses.filter(course => course.category === category)
        : courses;
    
    updateGraph(filteredCourses);
    updateCourseList(filteredCourses);
    
    // Update filter button styles
    document.querySelectorAll('#category-filters button').forEach(button => {
        const isSelected = (category === null && button.textContent.trim() === 'All Courses') ||
                         (button.textContent.trim() === category?.split('/')[0]);
        
        button.className = `px-4 py-2 rounded-full text-sm font-semibold ${
            isSelected 
                ? 'text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`;
        
        if (isSelected && category) {
            button.style.backgroundColor = button.style.getPropertyValue('--category-color');
        } else if (isSelected) {
            button.className = 'px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-white';
        }
    });
}

function initializeGraph(courses) {
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
    
    simulation = d3.forceSimulation()
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(60));
    
    updateGraph(courses);
}

function updateGraph(courses) {
    const g = d3.select('#graph g');
    
    // Update nodes
    const node = g.selectAll('.node')
        .data(courses, d => d.code);
    
    // Remove old nodes
    node.exit().remove();
    
    // Add new nodes
    const nodeEnter = node.enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    nodeEnter.append('circle')
        .attr('r', 30)
        .style('fill', d => categoryColors[d.category]);
    
    nodeEnter.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 5)
        .text(d => d.code);
    
    // Update simulation
    simulation.nodes(courses)
        .on('tick', () => {
            g.selectAll('.node')
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });
    
    simulation.alpha(1).restart();
}

function updateCourseList(courses) {
    const courseList = document.getElementById('course-list');
    courseList.innerHTML = `
        <h2 class="text-xl font-bold mb-4">${
            courses.length === window.courses.length ? 'All Courses' : 'Filtered Courses'
        }</h2>
        <div class="space-y-2">
            ${courses.map(course => `
                <div class="course-item" style="border-color: ${categoryColors[course.category]}">
                    <h3 class="font-semibold">${course.code}</h3>
                    <p class="text-sm text-gray-600">${course.name}</p>
                    <div class="mt-2 flex items-center gap-2">
                        <span class="category-badge" style="background-color: ${categoryColors[course.category]}">
                            ${course.category.split('/')[0]}
                        </span>
                        <span class="text-xs text-gray-500">
                            ${course.credits} ${course.credits === 1 ? 'Credit' : 'Credits'}
                        </span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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

const categoryColors = {
    "Electrical Engineering/Hardware": "#2563eb",
    "Software Engineering": "#16a34a",
    "Embedded/Firmware Engineering": "#9333ea",
    "General/Uncategorized": "#64748b"
};
