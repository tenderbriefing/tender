'use client'

import { useState } from 'react'
import { XMarkIcon, DocumentTextIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface TenderAnalysis {
  summary: string
  keyRequirements: string[]
  eligibilityCriteria: string[]
  submissionDeadline: string
  estimatedValue: number
  riskLevel: 'low' | 'medium' | 'high'
  recommendations: string[]
  complianceNotes: string[]
}

interface TenderAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  tenderTitle: string
  documentText: string
}

export default function TenderAnalysisModal({ isOpen, onClose, tenderTitle, documentText }: TenderAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeDocument = async () => {
    if (!documentText.trim()) {
      setError('No document text provided for analysis')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/analyze-tender', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentText,
          tenderTitle
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        throw new Error(data.error || 'Failed to analyze document')
      }
    } catch (error) {
      console.error('Error analyzing document:', error)
      setError('Failed to analyze document. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return 'text-green-600 bg-green-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'high':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="h-8 w-8" />
            <div>
              <h2 className="text-xl font-bold">AI Tender Analysis</h2>
              <p className="text-blue-100 text-sm mt-1">{tenderTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!analysis && !isAnalyzing && !error && (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
              <p className="text-gray-600 mb-6">
                Click the button below to get an AI-powered analysis of this tender document.
              </p>
              <button
                onClick={analyzeDocument}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Analyze Tender Document
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Document</h3>
              <p className="text-gray-600">
                Our AI is processing the tender document to provide you with key insights...
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={analyzeDocument}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Summary</h3>
                <p className="text-blue-800">{analysis.summary}</p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-1">Estimated Value</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {analysis.estimatedValue > 0 ? formatCurrency(analysis.estimatedValue) : 'Not specified'}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-1">Risk Level</h4>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(analysis.riskLevel)}`}>
                    {analysis.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-1">Deadline</h4>
                  <p className="text-lg font-semibold text-gray-700">
                    {analysis.submissionDeadline || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Key Requirements */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Key Requirements
                </h3>
                <ul className="space-y-2">
                  {analysis.keyRequirements.map((requirement, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></span>
                      <span className="text-gray-700">{requirement}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Eligibility Criteria */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Eligibility Criteria</h3>
                <ul className="space-y-2">
                  {analysis.eligibilityCriteria.map((criteria, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3"></span>
                      <span className="text-gray-700">{criteria}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">AI Recommendations</h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></span>
                      <span className="text-gray-700">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Compliance Notes */}
              {analysis.complianceNotes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Compliance Notes</h3>
                  <ul className="space-y-2">
                    {analysis.complianceNotes.map((note, index) => (
                      <li key={index} className="flex items-start">
                        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></span>
                        <span className="text-gray-700">{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
