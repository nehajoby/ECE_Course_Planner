import React from 'react';
import { categories, categoryColors } from '../data/courses';

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <button
        className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors
          ${!selectedCategory 
            ? 'bg-gray-800 text-white' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
        onClick={() => onCategoryChange(null)}
      >
        All Courses
      </button>
      {categories.map(category => (
        <button
          key={category}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors
            ${selectedCategory === category
              ? 'text-white'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          style={{
            backgroundColor: selectedCategory === category 
              ? categoryColors[category] 
              : undefined
          }}
          onClick={() => onCategoryChange(category)}
        >
          {category.split('/')[0]}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
