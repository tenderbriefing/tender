'use client';

import { useState, useEffect } from 'react';
import { MapPinIcon, StarIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';

interface ConnectorMatch {
  connectorId: string;
  connectorProfile: {
    uid: string;
    displayName: string;
    location: string;
    rating: number;
    totalJobs: number;
    skills: string[];
  };
  distance: number;
  rating: number;
  availability: boolean;
  skills: string[];
  matchScore: number;
}

interface ConnectorMatchingProps {
  tenderId: string;
  tenderTitle: string;
  briefingDate: string;
  briefingTime: string;
  location: {
    address: string;
    city: string;
    province: string;
  };
  onConnectorSelected?: (connectorId: string) => void;
}

const ConnectorMatching = ({
  tenderId,
  tenderTitle,
  briefingDate,
  briefingTime,
  location,
  onConnectorSelected
}: ConnectorMatchingProps) => {
  const [matches, setMatches] = useState<ConnectorMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const findConnectors = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/matching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'find-connectors',
          tenderId,
          tenderTitle,
          briefingDate: new Date(briefingDate),
          briefingTime,
          location,
          maxDistance: 30
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMatches(result.data.matches);
      } else {
        setError(result.message || 'Failed to find connectors');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error finding connectors:', err);
    } finally {
      setLoading(false);
    }
  };

  const notifyConnectors = async () => {
    if (matches.length === 0) return;

    try {
      const response = await fetch('/api/matching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'notify-connectors',
          matches,
          request: {
            tenderId,
            tenderTitle,
            briefingDate: new Date(briefingDate),
            briefingTime,
            location,
            maxDistance: 30
          }
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Notifications sent to ${matches.length} connectors!`);
      } else {
        setError(result.message || 'Failed to notify connectors');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error notifying connectors:', err);
    }
  };

  const selectConnector = (connectorId: string) => {
    setSelectedConnector(connectorId);
    if (onConnectorSelected) {
      onConnectorSelected(connectorId);
    }
  };

  useEffect(() => {
    findConnectors();
  }, [tenderId]);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600">Finding connectors...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={findConnectors}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Connector Matching</h3>
            <p className="text-sm text-gray-600 mt-1">
              Found {matches.length} connectors within 30km radius
            </p>
          </div>
          <button
            onClick={notifyConnectors}
            disabled={matches.length === 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Notify Connectors
          </button>
        </div>
      </div>

      {/* Tender Details */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3">Tender Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Tender Title</p>
            <p className="text-gray-900">{tenderTitle}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Briefing Date & Time</p>
            <p className="text-gray-900">{briefingDate} at {briefingTime}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-600">Location</p>
            <p className="text-gray-900">{location.address}, {location.city}, {location.province}</p>
          </div>
        </div>
      </div>

      {/* Connector Matches */}
      {matches.length > 0 ? (
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Available Connectors</h4>
          {matches.map((match) => (
            <div
              key={match.connectorId}
              className={`card cursor-pointer transition-all duration-200 ${
                selectedConnector === match.connectorId
                  ? 'ring-2 ring-primary-500 bg-primary-50'
                  : 'hover:shadow-md'
              }`}
              onClick={() => selectConnector(match.connectorId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary-100 rounded-full p-2">
                      <UserIcon className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900">
                        {match.connectorProfile.displayName}
                      </h5>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          {match.distance}km away
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <StarIcon className="h-4 w-4 mr-1" />
                          {match.rating.toFixed(1)} ({match.connectorProfile.totalJobs} jobs)
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {match.availability ? 'Available' : 'Busy'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {match.skills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-600 mb-1">Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {match.skills.slice(0, 5).map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {skill}
                          </span>
                        ))}
                        {match.skills.length > 5 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            +{match.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-primary-600">
                    {match.matchScore}%
                  </div>
                  <div className="text-xs text-gray-500">Match Score</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-8">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No connectors found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No available connectors found within 30km radius for this briefing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectorMatching;
