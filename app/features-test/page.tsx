'use client'

import { useState } from 'react'
import { 
  CloudArrowUpIcon, 
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { useAnalytics } from '@/hooks/useAnalytics'

export default function FeaturesTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [processingResult, setProcessingResult] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const analytics = useAnalytics()

  const handleFileUpload = async () => {
    if (!file) return

    setIsUploading(true)
    analytics.trackFileUpload(file.type, file.size)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'test-uploads')
      formData.append('options', JSON.stringify({
        quality: 'auto',
        format: 'auto',
      }))

      const response = await fetch('/api/file-processing/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      setUploadResult(result)
      analytics.trackEvent({
        action: 'file_upload_success',
        category: 'file_processing',
        label: file.type,
      })
    } catch (error) {
      console.error('Upload error:', error)
      analytics.trackError('File upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileProcessing = async (operation: string) => {
    if (!uploadResult?.file?.publicId) return

    setIsProcessing(true)

    try {
      const response = await fetch('/api/file-processing/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicId: uploadResult.file.publicId,
          operation,
          options: operation === 'generate-thumbnail' ? { size: 300 } : {},
        }),
      })

      const result = await response.json()
      setProcessingResult(result)
      analytics.trackEvent({
        action: 'file_processing_success',
        category: 'file_processing',
        label: operation,
      })
    } catch (error) {
      console.error('Processing error:', error)
      analytics.trackError('File processing failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAnalyticsTest = () => {
    analytics.trackEvent({
      action: 'analytics_test',
      category: 'testing',
      label: 'features_test_page',
      value: 1,
    })
    analytics.trackConversion('feature_test_completed')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Advanced Features Test
          </h1>
          <p className="text-xl text-gray-600">
            Test file processing and analytics (push notifications retired — Batch C)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <CloudArrowUpIcon className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">File Processing</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <button
                onClick={handleFileUpload}
                disabled={!file || isUploading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload File'}
              </button>

              {uploadResult && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Upload Result:</h4>
                  <div className="text-sm text-gray-600">
                    <p>URL: <a href={uploadResult.file?.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View File</a></p>
                    <p>Size: {uploadResult.file?.bytes} bytes</p>
                    <p>Format: {uploadResult.file?.format}</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleFileProcessing('generate-thumbnail')}
                      disabled={isProcessing}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      Generate Thumbnail
                    </button>
                    <button
                      onClick={() => handleFileProcessing('extract-text')}
                      disabled={isProcessing}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      Extract Text
                    </button>
                  </div>
                </div>
              )}

              {processingResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <h4 className="font-medium text-gray-900 mb-2">Processing Result:</h4>
                  <pre className="text-xs text-gray-600 overflow-auto">
                    {JSON.stringify(processingResult.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <ChartBarIcon className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Analytics</h3>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>Google Analytics 4 is integrated and tracking:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Page views</li>
                  <li>User interactions</li>
                  <li>Custom events</li>
                  <li>Conversions</li>
                  <li>Error tracking</li>
                </ul>
              </div>

              <button
                onClick={handleAnalyticsTest}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Test Analytics Event
              </button>

              <div className="text-xs text-gray-500">
                <p>Check your Google Analytics dashboard to see the tracked events.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Feature Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <CloudArrowUpIcon className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium">File Processing</p>
                <p className="text-sm text-gray-500">Cloudinary Integration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-sm text-gray-500">Google Analytics 4</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
