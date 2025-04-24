from bs4 import BeautifulSoup
import csv

def parse_course_title(full_title):
    parts = full_title.split('.')
    course_id = parts[0].strip()
    course_name = '.'.join(parts[1:]).strip()  # Get title and hours
    return course_id, course_name

def extract_courses(html):
    soup = BeautifulSoup(html, 'html.parser')
    courses = []
    connections = []
    descriptions = []

    for courseblock in soup.find_all('div', class_='courseblock'):
        title_element = courseblock.find('p', class_='courseblocktitle noindent')
        if not title_element:
            continue

        full_title = title_element.get_text(strip=True)
        course_id, course_title = parse_course_title(full_title)
        courses.append((course_id, course_title))

        # Description
        desc_element = courseblock.find('p', class_='cb_desc')
        description = desc_element.get_text(strip=True) if desc_element else ''
        descriptions.append((course_id, description))

        # Prerequisites / Corequisites
        extra_elements = courseblock.find_all('p', class_='courseblockextra noindent')
        for extra in extra_elements:
            text = extra.get_text(strip=True)
            if "Prerequisite(s):" in text:
                for prereq in extra.find_all('a', class_='bubblelink code'):
                    prereq_id = prereq.text.strip()
                    connections.append((course_id, prereq_id, 'red'))
            elif "Corequisite(s):" in text:
                for coreq in extra.find_all('a', class_='bubblelink code'):
                    coreq_id = coreq.text.strip()
                    connections.append((course_id, coreq_id, 'blue'))

    return courses, connections, descriptions

def write_nodes_to_csv(courses, filename):
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Course ID', 'Full Title'])
        for course_id, course_title in courses:
            writer.writerow([course_id, course_title])

def write_connections_to_csv(connections, filename):
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Source', 'Target', 'Color'])
        for connection in connections:
            writer.writerow(connection)

def write_descriptions_to_csv(descriptions, filename):
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Course ID', 'Description'])
        for course_id, description in descriptions:
            writer.writerow([course_id, description])

def main():
    input_file = 'input.html'
    output_nodes_file = 'updatenodes.csv'
    output_connections_file = 'connections.csv'
    output_descriptions_file = 'descriptions.csv'

    with open(input_file, 'r', encoding='utf-8') as file:
        html_data = file.read()

    courses, connections, descriptions = extract_courses(html_data)

    write_nodes_to_csv(courses, output_nodes_file)
    write_connections_to_csv(connections, output_connections_file)
    write_descriptions_to_csv(descriptions, output_descriptions_file)

    print("Done! Check: 'nodes.csv', 'connections.csv', and 'descriptions.csv'.")

if __name__ == '__main__':
    main()
