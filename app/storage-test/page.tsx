'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import FileUpload from '@/components/ui/FileUpload'

const StorageTestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])

  const testStatus = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/storage?action=status')
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const listFiles = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/storage?action=list&maxResults=50')
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setFiles(data.data)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const getFileMetadata = async (fileName: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/storage?action=metadata&fileName=${encodeURIComponent(fileName)}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const generateSignedUrl = async (fileName: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/storage?action=signed-url&fileName=${encodeURIComponent(fileName)}&expiresIn=3600`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const makeFilePublic = async (fileName: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/storage?action=make-public&fileName=${encodeURIComponent(fileName)}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (fileName: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/storage?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      setResult(data)
      if (data.success) {
        // Refresh file list
        listFiles()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (file: File, result: any) => {
    setUploadedFiles(prev => [...prev, { file, result }])
    // Refresh file list
    listFiles()
  }

  const handleUploadError = (error: string) => {
    setResult({ success: false, error })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleHeader />
      <main className="flex-grow container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Google Cloud Storage Test</h1>
        <p className="text-center text-gray-600 mb-8">
          Test Google Cloud Storage integration for file uploads and management.
        </p>

        <div className="max-w-6xl mx-auto">
          {/* Status Check */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Storage Service Status</h2>
            <button
              onClick={testStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {/* File Upload */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
            <FileUpload
              onUpload={handleFileUpload}
              onError={handleUploadError}
              accept="*/*"
              maxSize={10}
              multiple={true}
              className="mb-4"
            />
            
            {uploadedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Recently Uploaded Files:</h3>
                <div className="space-y-2">
                  {uploadedFiles.slice(-5).map((item, index) => (
                    <div key={index} className="bg-green-50 p-3 rounded border border-green-200">
                      <p className="text-sm font-medium text-green-800">{item.file.name}</p>
                      <p className="text-xs text-green-600">
                        Size: {formatFileSize(item.file.size)} • 
                        Type: {item.file.type || 'Unknown'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File Management */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">File Management</h2>
            <div className="space-x-4 mb-4">
              <button
                onClick={listFiles}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'List Files'}
              </button>
            </div>

            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Files in Storage ({files.length}):</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {files.map((file, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{file.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{formatFileSize(file.size)}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{file.contentType}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(file.timeCreated).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm space-x-2">
                            <button
                              onClick={() => getFileMetadata(file.name)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Info
                            </button>
                            <button
                              onClick={() => generateSignedUrl(file.name)}
                              className="text-green-600 hover:text-green-800 text-xs"
                            >
                              URL
                            </button>
                            <button
                              onClick={() => makeFilePublic(file.name)}
                              className="text-purple-600 hover:text-purple-800 text-xs"
                            >
                              Public
                            </button>
                            <button
                              onClick={() => deleteFile(file.name)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {loading && (
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="mt-4 text-lg text-gray-700">Processing request...</p>
            </div>
          )}

          {result && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Results</h2>
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center mb-2">
                  <span className={`inline-block w-3 h-3 rounded-full mr-2 ${result.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{result.success ? 'Success' : 'Error'}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                {result.data && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Data:</h3>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
                {result.error && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2 text-red-700">Error:</h3>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Storage Information */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Storage Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">Bucket Details:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• Bucket Name: tenderbriefing</li>
                  <li>• Project ID: tenderbriefing-472813</li>
                  <li>• Location: EU (multiple regions)</li>
                  <li>• Storage Class: Standard</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Features:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• File upload/download</li>
                  <li>• Signed URL generation</li>
                  <li>• Public/private access control</li>
                  <li>• Metadata management</li>
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <a 
                href="https://console.cloud.google.com/storage/browser/tenderbriefing;tab=objects?project=tenderbriefing-472813"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open Storage Console →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default StorageTestPage
