'use client'

import { useState } from 'react'
import { DocumentTextIcon, ChatBubbleLeftRightIcon, SparklesIcon } from '@heroicons/react/24/outline'
import AIChatbot from '@/components/ai/AIChatbot'
import TenderAnalysisModal from '@/components/ai/TenderAnalysisModal'

export default function AITestPage() {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [showChatbot, setShowChatbot] = useState(false)

  const sampleTenderDocument = `
    TENDER NOTICE: SUPPLY OF OFFICE EQUIPMENT AND FURNITURE
    
    The Department of Public Works invites tenders for the supply of office equipment and furniture for government buildings in Pretoria, Gauteng.
    
    REQUIREMENTS:
    - Valid tax clearance certificate
    - CIDB registration (Grade 3 or higher)
    - BBBEE Level 1 or 2 contributor
    - Minimum 3 years experience in office equipment supply
    - Proof of financial capability (minimum R2 million turnover)
    
    ELIGIBILITY CRITERIA:
    - South African registered company
    - 51% black ownership (BBBEE requirement)
    - Valid SARS tax clearance
    - No outstanding government debt
    
    SUBMISSION DEADLINE: 15 March 2024 at 12:00 PM
    BRIEFING DATE: 1 March 2024 at 10:00 AM
    BRIEFING VENUE: Government Buildings, Pretoria
    
    ESTIMATED VALUE: R5,000,000 (excluding VAT)
    
    COMPLIANCE REQUIREMENTS:
    - All bidders must attend the compulsory briefing
    - Documents must be submitted in sealed envelopes
    - Late submissions will not be considered
    - Bidders must comply with all government procurement regulations
  `

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <SparklesIcon className="h-16 w-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            TenderConnect AI Features
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience the power of AI in tender analysis, smart recommendations, and intelligent assistance.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Document Analysis */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <DocumentTextIcon className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Document Analysis</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Upload tender documents and get instant AI-powered analysis including requirements, 
              eligibility criteria, risk assessment, and actionable recommendations.
            </p>
            <button
              onClick={() => setShowAnalysisModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Test Document Analysis
            </button>
          </div>

          {/* AI Chatbot */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">AI Assistant</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Get instant answers to your tender questions, compliance guidance, and personalized 
              recommendations from our AI-powered assistant.
            </p>
            <button
              onClick={() => setShowChatbot(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Open AI Chatbot
            </button>
          </div>

          {/* Smart Matching */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <SparklesIcon className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Smart Matching</h3>
            </div>
            <p className="text-gray-600 mb-4">
              AI-powered connector matching based on location, experience, availability, 
              and tender requirements for optimal results.
            </p>
            <button
              disabled
              className="w-full bg-gray-400 text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Sample Tender Document */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Sample Tender Document</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {sampleTenderDocument}
            </pre>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This sample document can be used to test the AI analysis features above.
          </p>
        </div>

        {/* AI Features Overview */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-blue-900 mb-4">AI Features Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Document Analysis</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Automatic requirement extraction</li>
                <li>• Risk level assessment</li>
                <li>• Compliance checking</li>
                <li>• Actionable recommendations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">AI Assistant</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• BBBEE compliance guidance</li>
                <li>• Tender process explanations</li>
                <li>• Document requirement help</li>
                <li>• Personalized suggestions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TenderAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        tenderTitle="Supply of Office Equipment and Furniture"
        documentText={sampleTenderDocument}
      />

      {/* AI Chatbot */}
      <AIChatbot context={{ page: 'ai-test' }} />
    </div>
  )
}
