'use client';

import { useState } from 'react';
import { CATEGORIES, searchCategories } from '@/lib/data/commodities';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface CategorySelectionProps {
  selectedCategories: string[];
  onSelectionChange: (categories: string[]) => void;
  maxSelections?: number;
}

const CategorySelection = ({ 
  selectedCategories, 
  onSelectionChange, 
  maxSelections = 5 
}: CategorySelectionProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Filter categories based on search
  const filteredCategories = (() => {
    let filtered = CATEGORIES;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = searchCategories(searchQuery);
    }

    // Filter by selected only
    if (showSelectedOnly) {
      filtered = filtered.filter(category => 
        selectedCategories.includes(category.id)
      );
    }

    return filtered;
  })();

  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      // Remove category
      onSelectionChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      // Add category (if under limit)
      if (selectedCategories.length < maxSelections) {
        onSelectionChange([...selectedCategories, categoryId]);
      }
    }
  };

  const getSelectedCategoryNames = () => {
    return selectedCategories
      .map(id => CATEGORIES.find(c => c.id === id)?.name)
      .filter(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Select Your Business Categories
        </h3>
        <p className="text-sm text-gray-600">
          Choose up to {maxSelections} categories that your business can provide. 
          This helps us match you with relevant tender opportunities.
        </p>
        {selectedCategories.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Selected: {selectedCategories.length}/{maxSelections}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {getSelectedCategoryNames().map((name, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Show Selected Only Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="showSelectedOnly"
            checked={showSelectedOnly}
            onChange={(e) => setShowSelectedOnly(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="showSelectedOnly" className="ml-2 text-sm text-gray-700">
            Show selected categories only
          </label>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No categories found matching your criteria.</p>
          </div>
        ) : (
          filteredCategories.map(category => {
            const isSelected = selectedCategories.includes(category.id);
            const isDisabled = !isSelected && selectedCategories.length >= maxSelections;

            return (
              <div
                key={category.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : isDisabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => !isDisabled && handleCategoryToggle(category.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <p className="mt-1 text-sm text-gray-600">{category.description}</p>
                    {category.examples && category.examples.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {category.examples.slice(0, 3).map((example, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600"
                          >
                            {example}
                          </span>
                        ))}
                        {category.examples.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                            +{category.examples.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {isSelected ? (
                      <div className="flex items-center justify-center w-6 h-6 bg-primary-600 rounded-full">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selection Summary */}
      {selectedCategories.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Selection Summary</h4>
          <p className="text-sm text-green-700">
            You have selected {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'}. 
            You can change your selection at any time in your profile settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default CategorySelection;
