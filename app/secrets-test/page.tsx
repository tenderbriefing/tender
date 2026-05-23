'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const SecretsTestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [secrets, setSecrets] = useState<string[]>([])
  const [secretName, setSecretName] = useState('')
  const [secretValue, setSecretValue] = useState('')

  const listSecrets = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/secrets?action=list')
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setSecrets(data.data)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const getSecret = async (name: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/secrets?action=get&name=${encodeURIComponent(name)}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const createSecret = async () => {
    if (!secretName || !secretValue) {
      setResult({ success: false, error: 'Secret name and value are required' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          name: secretName,
          value: secretValue
        }),
      })
      
      const data = await response.json()
      setResult(data)
      
      if (data.success) {
        setSecretName('')
        setSecretValue('')
        // Refresh the secrets list
        listSecrets()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleHeader />
      <main className="flex-grow container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Google Secret Manager Test</h1>
        <p className="text-center text-gray-600 mb-8">
          Test Google Secret Manager integration for secure configuration storage.
        </p>

        <div className="max-w-4xl mx-auto">
          {/* List Secrets */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">List Secrets</h2>
            <button
              onClick={listSecrets}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'List All Secrets'}
            </button>

            {secrets.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Available Secrets:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {secrets.map((secret, index) => (
                    <button
                      key={index}
                      onClick={() => getSecret(secret)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded text-sm transition-colors"
                    >
                      {secret}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create Secret */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Secret</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Name
                </label>
                <input
                  type="text"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="e.g., firebase-api-key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Value
                </label>
                <textarea
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Enter the secret value..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={createSecret}
                disabled={loading || !secretName || !secretValue}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Secret'}
              </button>
            </div>
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

          {/* Setup Instructions */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Setup Instructions</h2>
            <div className="space-y-2 text-sm">
              <p>1. <strong>Enable Secret Manager API</strong> in Google Cloud Console</p>
              <p>2. <strong>Set up IAM permissions</strong> for your service account</p>
              <p>3. <strong>Create secrets</strong> using the form above or Google Cloud Console</p>
              <p>4. <strong>Test secret retrieval</strong> by clicking on secret names</p>
            </div>
            <div className="mt-4">
              <a 
                href="https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-472813"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open Secret Manager Console →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default SecretsTestPage
