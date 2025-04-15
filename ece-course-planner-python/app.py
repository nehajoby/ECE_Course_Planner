from flask import Flask, render_template, jsonify
import json

app = Flask(__name__)

# Course data
courses = [
    {
        "code": "EECE 2150",
        "name": "Circuits and Signals: Biomedical Applications",
        "credits": 5,
        "category": "Electrical Engineering/Hardware"
    },
    {
        "code": "EECE 2160",
        "name": "Embedded Design: Enabling Robotics",
        "credits": 4,
        "category": "Embedded/Firmware Engineering"
    },
    # Add more courses here
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

@app.route('/')
def index():
    return render_template('index.html', 
                         categories=categories,
                         category_colors=category_colors)

@app.route('/api/courses')
def get_courses():
    return jsonify(courses)

if __name__ == '__main__':
    app.run(debug=True)
