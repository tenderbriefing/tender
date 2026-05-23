'use client'

import { useState } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { 
  XMarkIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface WorkSubmissionModalProps {
  job: {
    id: string
    tenderTitle: string
    organization: string
    briefingDate: Date
    briefingTime: string
    briefingVenue: string
  }
  isOpen: boolean
  onClose: () => void
  onSubmissionSuccess?: () => void
}

const WorkSubmissionModal = ({ job, isOpen, onClose, onSubmissionSuccess }: WorkSubmissionModalProps) => {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form')
  const [formData, setFormData] = useState({
    attendanceProof: null as File | null,
    audioRecording: null as File | null,
    summaryNotes: '',
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleFileChange = (field: 'attendanceProof' | 'audioRecording', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.attendanceProof) {
      newErrors.attendanceProof = 'Attendance proof is required'
    }

    if (!formData.audioRecording) {
      newErrors.audioRecording = 'Audio recording is required'
    }

    if (!formData.summaryNotes.trim()) {
      newErrors.summaryNotes = 'Summary notes are required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setStep('processing')

    try {
      // TODO: Upload files to Firebase Storage first
      // For now, we'll simulate file upload
      const attendanceProofUrl = `attendance_${job.id}_${Date.now()}.jpg`
      const audioRecordingUrl = `audio_${job.id}_${Date.now()}.mp3`

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submitWork',
          bookingId: job.id,
          attendanceProof: attendanceProofUrl,
          audioRecording: audioRecordingUrl,
          summaryNotes: formData.summaryNotes,
          notes: formData.notes
        })
      })

      const result = await response.json()

      if (result.success) {
        setStep('success')
        toast.success('Work submitted successfully!')
        
        if (onSubmissionSuccess) {
          onSubmissionSuccess()
        }
        
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose()
          setStep('form')
          // Reset form
          setFormData({
            attendanceProof: null,
            audioRecording: null,
            summaryNotes: '',
            notes: ''
          })
        }, 2000)
      } else {
        toast.error(result.error || 'Failed to submit work')
        setStep('form')
      }
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('An error occurred while submitting work')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  const renderFormStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
          <DocumentTextIcon className="h-6 w-6 text-primary-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Submit Your Work
        </h3>
        <p className="text-sm text-gray-600">
          Upload your briefing materials and notes
        </p>
      </div>

      {/* Job Details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-gray-900">{job.tenderTitle}</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Organization:</strong> {job.organization}</p>
          <p><strong>Date:</strong> {job.briefingDate.toLocaleDateString()}</p>
          <p><strong>Time:</strong> {job.briefingTime}</p>
          <p><strong>Venue:</strong> {job.briefingVenue}</p>
        </div>
      </div>

      {/* File Uploads */}
      <div className="space-y-4">
        {/* Attendance Proof */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <PhotoIcon className="h-4 w-4 inline mr-1" />
            Attendance Proof (Required)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('attendanceProof', e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload a photo of the attendance register with your company name visible (Max 5MB)
          </p>
          {errors.attendanceProof && (
            <p className="text-red-500 text-sm mt-1">{errors.attendanceProof}</p>
          )}
        </div>

        {/* Audio Recording */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MicrophoneIcon className="h-4 w-4 inline mr-1" />
            Audio Recording (Required)
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => handleFileChange('audioRecording', e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload the audio recording of the entire briefing session (Max 50MB)
          </p>
          {errors.audioRecording && (
            <p className="text-red-500 text-sm mt-1">{errors.audioRecording}</p>
          )}
        </div>
      </div>

      {/* Summary Notes */}
      <div>
        <label htmlFor="summaryNotes" className="block text-sm font-medium text-gray-700 mb-2">
          Summary Notes (Required)
        </label>
        <textarea
          id="summaryNotes"
          name="summaryNotes"
          rows={6}
          value={formData.summaryNotes}
          onChange={handleInputChange}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            errors.summaryNotes ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Provide a detailed summary of the briefing, including key points, requirements, deadlines, and any important information discussed..."
        />
        {errors.summaryNotes && (
          <p className="text-red-500 text-sm mt-1">{errors.summaryNotes}</p>
        )}
      </div>

      {/* Additional Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Any additional observations, questions, or comments about the briefing..."
        />
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Submission Guidelines</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Ensure attendance register clearly shows your company name</li>
          <li>• Audio recording should be clear and complete</li>
          <li>• Summary notes should be detailed and well-structured</li>
          <li>• All materials will be reviewed for quality</li>
        </ul>
      </div>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
        <LoadingSpinner size="lg" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Submitting Your Work
        </h3>
        <p className="text-sm text-gray-600">
          Please wait while we upload your files and process your submission...
        </p>
      </div>
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center text-sm text-blue-800">
          <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
          <span>Your work will be reviewed for quality before payment is released</span>
        </div>
      </div>
    </div>
  )

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
        <CheckCircleIcon className="h-6 w-6 text-green-600" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Work Submitted Successfully!
        </h3>
        <p className="text-sm text-gray-600">
          Your briefing materials have been submitted and are being reviewed.
        </p>
      </div>
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-green-800 space-y-1 text-left">
          <li>• Your work will be reviewed for quality</li>
          <li>• You'll receive feedback within 24 hours</li>
          <li>• Payment will be released upon approval</li>
          <li>• You'll earn R200.00 for this job</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="absolute right-0 top-0 pr-4 pt-4">
              <button
                type="button"
                className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {step === 'form' && renderFormStep()}
            {step === 'processing' && renderProcessingStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {step === 'form' && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Submitting...
                  </>
                ) : (
                  'Submit Work'
                )}
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:w-auto"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkSubmissionModal
