import React from 'react';
import { categoryColors } from '../data/courses';

const CourseList = ({ courses, selectedCategory }) => {
  const filteredCourses = selectedCategory
    ? courses.filter(course => course.category === selectedCategory)
    : courses;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-xl font-bold mb-4">
        {selectedCategory ? selectedCategory : 'All Courses'}
      </h2>
      <div className="space-y-2">
        {filteredCourses.map(course => (
          <div
            key={course.code}
            className="p-4 rounded-lg border"
            style={{
              borderColor: categoryColors[course.category]
            }}
          >
            <h3 className="font-semibold">{course.code}</h3>
            <p className="text-sm text-gray-600">{course.name}</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="px-2 py-1 rounded-full text-xs text-white"
                style={{
                  backgroundColor: categoryColors[course.category]
                }}
              >
                {course.category.split('/')[0]}
              </span>
              <span className="text-xs text-gray-500">
                {course.credits} {course.credits === 1 ? 'Credit' : 'Credits'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseList;
