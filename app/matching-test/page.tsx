'use client';

import { useState } from 'react';
import ConnectorMatching from '@/components/matching/ConnectorMatching';
import SimpleHeader from '@/components/layout/SimpleHeader';

const MatchingTestPage = () => {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const handleConnectorSelected = (connectorId: string) => {
    setSelectedConnector(connectorId);
    console.log('Selected connector:', connectorId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleHeader />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connector Matching Test</h1>
          <p className="text-gray-600 mt-2">
            Test the connector matching algorithm for tender briefings
          </p>
        </div>

        {selectedConnector && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Connector Selected</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Selected connector ID: {selectedConnector}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConnectorMatching
          tenderId="test-tender-123"
          tenderTitle="Construction of New Office Building - Johannesburg CBD"
          briefingDate="2024-02-15"
          briefingTime="10:00 AM"
          location={{
            address: "123 Commissioner Street",
            city: "Johannesburg",
            province: "Gauteng"
          }}
          onConnectorSelected={handleConnectorSelected}
        />

        <div className="mt-8 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  1
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Find Connectors</h4>
                <p className="text-sm text-gray-600">
                  System searches for all active connectors within 30km radius of the tender location
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  2
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Calculate Match Score</h4>
                <p className="text-sm text-gray-600">
                  Each connector gets a score based on rating, distance, skills match, and experience
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  3
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Send Notifications</h4>
                <p className="text-sm text-gray-600">
                  Notify all matched connectors about the opportunity and ask for their interest
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  4
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Select Best Match</h4>
                <p className="text-sm text-gray-600">
                  Based on responses, select the best connector and assign them to the briefing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchingTestPage;
