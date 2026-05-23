'use client'

import { useState } from 'react'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const GmailTestPage = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    text: '',
    html: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState('')

  const testStatus = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail?action=status')
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const sendTestEmail = async () => {
    if (!emailForm.to || !emailForm.subject || (!emailForm.text && !emailForm.html)) {
      setResult({ success: false, error: 'Please fill in all required fields' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-email',
          ...emailForm
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setEmailForm({ to: '', subject: '', text: '', html: '' })
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const sendTenderNotification = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-tender-notification',
          recipientEmail: 'test@example.com',
          tenderTitle: 'Road Construction Project - Phase 2',
          briefingDate: '2024-01-15 10:00 AM',
          location: 'City Hall, Conference Room A',
          connectorName: 'John Connector'
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

  const sendWelcomeEmail = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-welcome-email',
          welcomeEmail: 'newuser@example.com',
          userName: 'Jane Smith',
          userType: 'entrepreneur'
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

  const sendPaymentConfirmation = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-payment-confirmation',
          paymentEmail: 'client@example.com',
          amount: 1500.00,
          serviceDescription: 'Tender Briefing Attendance Service',
          paymentDate: new Date().toLocaleDateString()
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

  const listMessages = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail?action=list-messages&maxResults=10')
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setMessages(data.data)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const searchMessages = async () => {
    if (!searchQuery.trim()) {
      setResult({ success: false, error: 'Please enter a search query' })
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/gmail?action=search-messages&query=${encodeURIComponent(searchQuery)}&maxResults=10`)
      const data = await response.json()
      setResult(data)
      if (data.success) {
        setMessages(data.data)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const getMessageDetails = async (messageId: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch(`/api/gmail?action=get-message&messageId=${messageId}`)
      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark-as-read',
          messageId
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listMessages()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-message',
          deleteMessageId: messageId
        }),
      })
      
      const data = await response.json()
      setResult(data)
      if (data.success) {
        listMessages()
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const truncateText = (text: string, maxLength: number = 100): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SimpleHeader />
      <main className="flex-grow container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Gmail API Test</h1>
        <p className="text-center text-gray-600 mb-8">
          Test Gmail integration for email communication and notifications.
        </p>

        <div className="max-w-6xl mx-auto">
          {/* Status Check */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Gmail Service Status</h2>
            <button
              onClick={testStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {/* Send Custom Email */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Send Custom Email</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Email *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({...emailForm, to: e.target.value})}
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  placeholder="Email subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Content
                </label>
                <textarea
                  value={emailForm.text}
                  onChange={(e) => setEmailForm({...emailForm, text: e.target.value})}
                  placeholder="Plain text content"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML Content
                </label>
                <textarea
                  value={emailForm.html}
                  onChange={(e) => setEmailForm({...emailForm, html: e.target.value})}
                  placeholder="HTML content"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={sendTestEmail}
                disabled={loading || !emailForm.to || !emailForm.subject || (!emailForm.text && !emailForm.html)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>

          {/* TenderConnect Email Templates */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">TenderConnect Email Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={sendTenderNotification}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Tender Notification'}
              </button>
              <button
                onClick={sendWelcomeEmail}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Welcome Email'}
              </button>
              <button
                onClick={sendPaymentConfirmation}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Payment Confirmation'}
              </button>
            </div>
          </div>

          {/* Message Management */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Message Management</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={listMessages}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'List Recent Messages'}
                </button>
              </div>
              
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages (e.g., 'from:example.com', 'subject:tender')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={searchMessages}
                  disabled={loading || !searchQuery.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {/* Messages List */}
          {messages.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4">Messages ({messages.length})</h2>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{message.subject || 'No Subject'}</h3>
                        <p className="text-sm text-gray-600">
                          <strong>From:</strong> {message.from}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>To:</strong> {Array.isArray(message.to) ? message.to.join(', ') : message.to}
                        </p>
                        <p className="text-sm text-gray-500">
                          <strong>Date:</strong> {formatDate(message.date)}
                        </p>
                        {message.snippet && (
                          <p className="text-sm text-gray-700 mt-2">
                            {truncateText(message.snippet)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => getMessageDetails(message.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => markAsRead(message.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Mark Read
                        </button>
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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

          {/* Gmail Information */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Gmail Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">Service Details:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• Project ID: tenderbriefing-472813</li>
                  <li>• API Key: dbc96530b2529d5442cf5bb059124031635b46a7</li>
                  <li>• OAuth2 Client ID: YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com</li>
                  <li>• Scopes: Gmail Send, Read, Modify, Compose</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Features:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• Send emails with HTML/text content</li>
                  <li>• TenderConnect email templates</li>
                  <li>• Message search and management</li>
                  <li>• Automated notifications</li>
                  <li>• Email tracking and status</li>
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <a 
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open Gmail →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default GmailTestPage
