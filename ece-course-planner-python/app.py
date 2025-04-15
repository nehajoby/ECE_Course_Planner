from flask import Flask, render_template, jsonify
import json
import networkx as nx

app = Flask(__name__)

# Course data with prerequisites
courses = [
    {
        "code": "EECE 2150",
        "name": "Circuits and Signals: Biomedical Applications",
        "credits": 5,
        "category": "Electrical Engineering/Hardware",
        "prerequisites": []
    },
    {
        "code": "EECE 2160",
        "name": "Embedded Design: Enabling Robotics",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 2150"]
    },
    {
        "code": "EECE 2210",
        "name": "Electrical Engineering",
        "credits": 4,
        "category": "General/Uncategorized",
        "prerequisites": ["EECE 2150"]
    },
    {
        "code": "EECE 2310",
        "name": "Introduction to Digital Design and Computer Architecture",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 2150"]
    },
    {
        "code": "EECE 2322",
        "name": "Fundamentals of Digital Design and Computer Organization",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 2310"]
    },
    {
        "code": "EECE 2412",
        "name": "Fundamentals of Electronics",
        "credits": 4,
        "category": "Electrical Engineering/Hardware",
        "prerequisites": ["EECE 2150"]
    },
    {
        "code": "EECE 2560",
        "name": "Fundamentals of Engineering Algorithms",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": []
    },
    {
        "code": "EECE 3324",
        "name": "Computer Architecture and Organization",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 2322"]
    },
    {
        "code": "EECE 3400",
        "name": "Introduction to Communication Systems",
        "credits": 4,
        "category": "Electrical Engineering/Hardware",
        "prerequisites": ["EECE 2150", "EECE 2412"]
    },
    {
        "code": "EECE 4520",
        "name": "Software Engineering 1",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": ["EECE 2560"]
    },
    {
        "code": "EECE 4534",
        "name": "Microprocessor-Based Design",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 3324"]
    },
    {
        "code": "EECE 4574",
        "name": "Wireless Communication Circuits",
        "credits": 4,
        "category": "Electrical Engineering/Hardware",
        "prerequisites": ["EECE 3400"]
    },
    {
        "code": "EECE 4604",
        "name": "Integrated Circuit Devices",
        "credits": 4,
        "category": "Electrical Engineering/Hardware",
        "prerequisites": ["EECE 2412"]
    },
    {
        "code": "EECE 4630",
        "name": "Robotics",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 2160", "EECE 2560"]
    },
    {
        "code": "EECE 5550",
        "name": "Mobile Robotics",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 4630"]
    },
    {
        "code": "EECE 5552",
        "name": "Assistive Robotics",
        "credits": 4,
        "category": "Embedded/Firmware Engineering",
        "prerequisites": ["EECE 4630"]
    },
    {
        "code": "EECE 5641",
        "name": "Introduction to Software Security",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": ["EECE 4520"]
    },
    {
        "code": "EECE 5642",
        "name": "Data Visualization",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": ["EECE 2560"]
    },
    {
        "code": "EECE 5644",
        "name": "Introduction to Machine Learning and Pattern Recognition",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": ["EECE 2560"]
    },
    {
        "code": "EECE 5645",
        "name": "Parallel Processing for Data Analytics",
        "credits": 4,
        "category": "Software Engineering",
        "prerequisites": ["EECE 2560"]
    }
]

categories = [
    "Electrical Engineering/Hardware",
    "Software Engineering",
    "Embedded/Firmware Engineering",
    "General/Uncategorized"
]

category_colors = {
    "Electrical Engineering/Hardware": "#2563eb",
    "Software Engineering": "#16a34a",
    "Embedded/Firmware Engineering": "#9333ea",
    "General/Uncategorized": "#64748b"
}

def build_graph(filtered_courses=None):
    if filtered_courses is None:
        filtered_courses = courses
    
    # Create a set of course codes in filtered courses
    filtered_codes = {course["code"] for course in filtered_courses}
    
    # Build graph data
    nodes = []
    links = []
    
    for course in filtered_courses:
        nodes.append({
            "id": course["code"],
            "name": course["name"],
            "category": course["category"],
            "credits": course["credits"]
        })
        
        # Only add links where both source and target are in filtered courses
        for prereq in course["prerequisites"]:
            if prereq in filtered_codes:
                links.append({
                    "source": prereq,
                    "target": course["code"]
                })
    
    return {"nodes": nodes, "links": links}

@app.route('/')
def index():
    return render_template('index.html', 
                         categories=categories,
                         category_colors=category_colors)

@app.route('/api/courses')
def get_courses():
    return jsonify(build_graph())

@app.route('/api/courses/<category>')
def get_courses_by_category(category):
    filtered_courses = [c for c in courses if c["category"] == category]
    return jsonify(build_graph(filtered_courses))

if __name__ == '__main__':
    app.run(debug=True)
