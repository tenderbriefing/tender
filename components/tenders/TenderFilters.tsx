'use client'

import { useState } from 'react'

interface TenderFiltersProps {
  filters: {
    category: string
    location: string
    status: string
  }
  onFiltersChange: (filters: any) => void
}

const TenderFilters = ({ filters, onFiltersChange }: TenderFiltersProps) => {
  const categories = [
    'All Categories',
    'Construction',
    'Technology',
    'Education',
    'Healthcare',
    'Transportation',
    'Energy',
    'Agriculture',
    'Manufacturing',
    'Services'
  ]

  const locations = [
    'All Locations',
    'Johannesburg',
    'Cape Town',
    'Durban',
    'Pretoria',
    'Port Elizabeth',
    'Bloemfontein',
    'Nelspruit',
    'Polokwane',
    'Kimberley'
  ]

  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'All Categories' || value === 'All Locations' ? '' : value
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      category: '',
      location: '',
      status: 'active'
    })
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button
          onClick={clearFilters}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-6">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={filters.category || 'All Categories'}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="form-input"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <select
            value={filters.location || 'All Locations'}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            className="form-input"
          >
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="space-y-2">
            {statuses.map((status) => (
              <label key={status.value} className="flex items-center">
                <input
                  type="radio"
                  name="status"
                  value={status.value}
                  checked={filters.status === status.value}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Estimated Value Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Value Range
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="10000000"
              step="100000"
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>R0</span>
              <span>R10M+</span>
            </div>
          </div>
        </div>

        {/* Briefing Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Briefing Date
          </label>
          <div className="space-y-2">
            <input
              type="date"
              className="form-input"
              placeholder="From date"
            />
            <input
              type="date"
              className="form-input"
              placeholder="To date"
            />
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.category || filters.location || filters.status !== 'active') && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Filters:</h4>
          <div className="flex flex-wrap gap-2">
            {filters.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.category}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
                >
                  ×
                </button>
              </span>
            )}
            {filters.location && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.location}
                <button
                  onClick={() => handleFilterChange('location', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
                >
                  ×
                </button>
              </span>
            )}
            {filters.status !== 'active' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.status}
                <button
                  onClick={() => handleFilterChange('status', 'active')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TenderFilters
