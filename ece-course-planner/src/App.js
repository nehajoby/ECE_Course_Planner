import React, { useState } from 'react';
import './App.css';
import CourseGraph from './components/CourseGraph';
import CategoryFilter from './components/CategoryFilter';
import CourseList from './components/CourseList';
import { courses } from './data/courses';

function App() {
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-600 text-white">
        <div className="container mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">ECE Course Planner</h1>
            <p className="text-xl mb-8">Visualize your academic journey with our interactive course prerequisite mapping tool</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Category Filter */}
        <div className="mb-8">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* Course Visualization and List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Graph */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-4" style={{ height: '600px' }}>
            <CourseGraph
              courses={courses}
              selectedCategory={selectedCategory}
            />
          </div>

          {/* Course List */}
          <div className="lg:col-span-1 overflow-auto" style={{ maxHeight: '600px' }}>
            <CourseList
              courses={courses}
              selectedCategory={selectedCategory}
            />
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; 2025 ECE Course Planner. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
