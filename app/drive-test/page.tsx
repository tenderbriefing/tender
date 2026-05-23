'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const DriveTestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [folderName, setFolderName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [selectedFileId, setSelectedFileId] = useState('')

  const testStatus = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive?action=status')
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createFolder = async () => {
    if (!folderName.trim()) {
      setResult({ success: false, error: 'Please enter a folder name' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-folder',
          folderName: folderName.trim()
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setFolderName('')
        listFiles()
      }
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
      const response = await fetch('/api/drive?action=list-files&pageSize=50')
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setFiles(data.data)
        setFolders(data.data.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder'))
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const searchFiles = async () => {
    if (!searchQuery.trim()) {
      setResult({ success: false, error: 'Please enter a search query' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/drive?action=search-files&query=${encodeURIComponent(searchQuery)}&pageSize=50`)
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

  const getFileDetails = async (fileId: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/drive?action=get-file&fileId=${fileId}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-document',
          docTitle: 'TenderConnect Test Document'
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listFiles()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createSpreadsheet = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-spreadsheet',
          sheetTitle: 'TenderConnect Test Spreadsheet'
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listFiles()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createTenderFolder = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create-tender-folder',
          tenderId: 'TEST-001',
          tenderTitle: 'Test Tender Project'
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listFiles()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const shareFile = async () => {
    if (!selectedFileId || !shareEmail.trim()) {
      setResult({ success: false, error: 'Please select a file and enter an email address' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'share-file',
          fileId: selectedFileId,
          emailAddress: shareEmail.trim(),
          role: 'reader'
        }),
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/drive?fileId=${fileId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listFiles()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: string | undefined): string => {
    if (!bytes) return 'Unknown'
    const size = parseInt(bytes)
    if (size === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(size) / Math.log(k))
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.includes('folder')) return '📁'
    if (mimeType.includes('document')) return '📄'
    if (mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('presentation')) return '📽️'
    if (mimeType.includes('image')) return '🖼️'
    if (mimeType.includes('video')) return '🎥'
    if (mimeType.includes('audio')) return '🎵'
    if (mimeType.includes('pdf')) return '📕'
    return '📄'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleHeader />
      <main className="flex-grow container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Google Drive API Test</h1>
        <p className="text-center text-gray-600 mb-8">
          Test Google Drive integration for document collaboration and file management.
        </p>

        <div className="max-w-6xl mx-auto">
          {/* Status Check */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Drive Service Status</h2>
            <button
              onClick={testStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {/* Create Folder */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Folder</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createFolder}
                disabled={loading || !folderName.trim()}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>

          {/* Create Documents */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Documents</h2>
            <div className="flex gap-4">
              <button
                onClick={createDocument}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Google Doc'}
              </button>
              <button
                onClick={createSpreadsheet}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Spreadsheet'}
              </button>
              <button
                onClick={createTenderFolder}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Tender Folder'}
              </button>
            </div>
          </div>

          {/* File Management */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">File Management</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={listFiles}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'List All Files'}
                </button>
              </div>
              
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={searchFiles}
                  disabled={loading || !searchQuery.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {/* Share File */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Share File</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select File ID
                </label>
                <input
                  type="text"
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  placeholder="Enter file ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="Enter email address..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={shareFile}
                disabled={loading || !selectedFileId || !shareEmail.trim()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Sharing...' : 'Share File'}
              </button>
            </div>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4">Files ({files.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {files.map((file, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">
                          <span className="text-lg">{getFileIcon(file.mimeType)}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{file.name}</div>
                            <div className="text-xs text-gray-500">ID: {file.id}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm space-x-2">
                          <button
                            onClick={() => getFileDetails(file.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Details
                          </button>
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 text-xs"
                            >
                              Open
                            </a>
                          )}
                          <button
                            onClick={() => deleteFile(file.id)}
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

          {/* Drive Information */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Google Drive Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">Service Details:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• Project ID: tenderbriefing-472813</li>
                  <li>• API Key: dbc96530b2529d5442cf5bb059124031635b46a7</li>
                  <li>• Scopes: Drive, Drive File, Drive Metadata</li>
                  <li>• Authentication: Service Account</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Features:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• File upload/download</li>
                  <li>• Folder creation</li>
                  <li>• Document collaboration</li>
                  <li>• File sharing</li>
                  <li>• Search functionality</li>
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <a 
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open Google Drive →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default DriveTestPage
