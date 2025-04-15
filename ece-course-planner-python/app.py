from flask import Flask, render_template, jsonify
import json
import networkx as nx
import pandas as pd
import os
import matplotlib.pyplot as plt

app = Flask(__name__)

# Course data with prerequisites
# TODO: Load data from csv files. with course codes, names, credits, categories, and prerequisites


categories = [
    "Electrical Engineering/Hardware",
    "Software Engineering",
    "Embedded/Firmware Engineering",
    "General/Uncategorized",
    "NonEECE"
]

# Create simplified category names for filtering
simplified_categories = {
    "Electrical Engineering": "Electrical Engineering/Hardware",
    "Software Engineering": "Software Engineering",
    "Embedded": "Embedded/Firmware Engineering",
    "General": "General/Uncategorized"
}

category_colors = {
    "Electrical Engineering/Hardware": "#2563eb",
    "Software Engineering": "#16a34a",
    "Embedded/Firmware Engineering": "#9333ea",
    "General/Uncategorized": "#64748b",
    "NonEECE": "#d3a4a4"
}

def build_graph(filtered_courses=None):
    courses_path = os.path.join(os.path.dirname(__file__), 'data', 'courses.csv')
    connections_path = os.path.join(os.path.dirname(__file__), 'data', 'connections.csv')
    descriptions_path = os.path.join(os.path.dirname(__file__), 'data', 'descriptions.csv')

    # Load data
    courses_df = pd.read_csv(courses_path)
    connections_df = pd.read_csv(connections_path, header=None, names=["course", "dependency", "type"])
    descriptions_df = pd.read_csv(descriptions_path)

    # Ensure all courses in connections are in courses.csv
    all_codes = set(courses_df['code'])
    all_courses_in_connections = set(connections_df['course']) | set(connections_df['dependency'])
    missing = all_courses_in_connections - all_codes
    
    if missing:
        # Add missing dependencies as NonEECE
        for code in missing:
            courses_df = pd.concat([
                courses_df,
                pd.DataFrame([[code, '', '', 'NonEECE']], columns=courses_df.columns)
            ], ignore_index=True)
        # Save updated courses.csv
        courses_df.to_csv(courses_path, index=False)

    # Build graph
    G = nx.DiGraph()
    for _, row in courses_df.iterrows():
        # Handle empty credits field
        credits = row['credits'] if pd.notna(row['credits']) else ''
        G.add_node(row['code'], name=row['name'], credits=credits, category=row['category'])
    
    for _, row in connections_df.iterrows():
        # Edge: dependency -> course (prereq/coreq)
        G.add_edge(row['dependency'], row['course'], type=row['type'])

    # Plot
    plt.figure(figsize=(16, 10))
    pos = nx.spring_layout(G, seed=42)
    categories = courses_df.set_index('code')['category'].to_dict()
    color_map = [category_colors.get(categories.get(node, 'NonEECE'), '#d3a4a4') for node in G.nodes]
    nx.draw(G, pos, with_labels=True, node_color=color_map, node_size=700, font_size=8, arrowsize=20)
    plt.title('ECE Course Dependencies')
    plt.tight_layout()
    plt.savefig(os.path.join(os.path.dirname(__file__), 'course_graph.png'))
    plt.close()

    # Filter courses if needed
    if filtered_courses is not None:
        filtered_codes = [c['id'] for c in filtered_courses]
        courses_df = courses_df[courses_df['code'].isin(filtered_codes)]

    # Create a dictionary of course descriptions for quick lookup
    descriptions_dict = {}
    for _, row in descriptions_df.iterrows():
        descriptions_dict[row['Course ID']] = row['Description']
    
    # Prepare data for API (nodes/links)
    nodes = [
        {
            "id": row['code'],
            "name": row['name'] if pd.notna(row['name']) else '',
            "credits": row['credits'] if pd.notna(row['credits']) else '',
            "category": row['category'],
            "description": descriptions_dict.get(row['code'], "No description available")
        }
        for _, row in courses_df.iterrows()
    ]
    
    # Only include links where both source and target are in the nodes
    node_ids = {node['id'] for node in nodes}
    links = [
        {
            "source": row['dependency'],
            "target": row['course'],
            "type": row['type']
        }
        for _, row in connections_df.iterrows()
        if (filtered_courses is None or (row['dependency'] in node_ids and row['course'] in node_ids))
    ]
    
    return {"nodes": nodes, "links": links}


@app.route('/')
def index():
    return render_template('index.html', 
                         categories=categories,
                         simplified_categories=simplified_categories,
                         category_colors=category_colors)

@app.route('/api/courses')
def get_courses():
    return jsonify(build_graph())

@app.route('/api/courses/<path:category>')
def get_courses_by_category(category):
    print(f"Filtering by category: {category}")
    courses_path = os.path.join(os.path.dirname(__file__), 'data', 'courses.csv')
    courses_df = pd.read_csv(courses_path)
    
    # Log available categories for debugging
    available_categories = courses_df['category'].unique()
    print(f"Available categories: {available_categories}")
    
    # Direct match with the full category name
    filtered_courses = courses_df[courses_df['category'] == category]
    print(f"Found {len(filtered_courses)} courses in category {category}")
    
    # If no courses were found and the category is Software Engineering, try again
    if len(filtered_courses) == 0 and category == "Software Engineering":
        print("Retrying with special handling for Software Engineering")
        filtered_courses = courses_df[courses_df['category'].str.strip() == "Software Engineering"]
        print(f"Found {len(filtered_courses)} courses with special handling")
    
    filtered_courses_list = [
        {
            "id": row['code'],
            "name": row['name'] if pd.notna(row['name']) else '',
            "credits": row['credits'] if pd.notna(row['credits']) else '',
            "category": row['category']
        }
        for _, row in filtered_courses.iterrows()
    ]
    
    return jsonify(build_graph(filtered_courses_list))

if __name__ == '__main__':
    app.run(debug=True, port=5001)
