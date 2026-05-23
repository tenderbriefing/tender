'use client'

import { useState, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface FileUploadProps {
  onUpload: (file: File, result: any) => void
  onError?: (error: string) => void
  accept?: string
  maxSize?: number // in MB
  multiple?: boolean
  uploadType?: 'general' | 'tender-document' | 'user-document' | 'submission'
  tenderId?: string
  userId?: string
  submissionId?: string
  documentType?: string
  fileType?: string
  className?: string
  disabled?: boolean
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onError,
  accept = '*/*',
  maxSize = 10, // 10MB default
  multiple = false,
  uploadType = 'general',
  tenderId,
  userId,
  submissionId,
  documentType,
  fileType,
  className = '',
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`
    }
    return null
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      let endpoint = '/api/storage'
      let payload: any = {
        action: 'upload',
        file: base64,
        fileName: file.name,
        contentType: file.type,
        options: {
          metadata: {
            metadata: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
            }
          }
        }
      }

      // Set specific upload action based on type
      switch (uploadType) {
        case 'tender-document':
          if (!tenderId || !documentType) {
            throw new Error('tenderId and documentType are required for tender document uploads')
          }
          payload = {
            action: 'upload-tender-document',
            tenderFile: base64,
            tenderId,
            documentType,
            tenderFileName: file.name
          }
          break
        case 'user-document':
          if (!userId || !documentType) {
            throw new Error('userId and documentType are required for user document uploads')
          }
          payload = {
            action: 'upload-user-document',
            userFile: base64,
            userId,
            userDocumentType: documentType,
            userFileName: file.name
          }
          break
        case 'submission':
          if (!submissionId || !fileType) {
            throw new Error('submissionId and fileType are required for submission uploads')
          }
          payload = {
            action: 'upload-submission',
            submissionFile: base64,
            submissionId,
            fileType,
            submissionFileName: file.name
          }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        onUpload(file, result)
      } else {
        throw new Error(result.message || 'Upload failed')
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed'
      onError?.(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      const validationError = validateFile(file)
      if (validationError) {
        onError?.(validationError)
        continue
      }
      
      await uploadFile(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled || uploading) return
    
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const openFileDialog = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <div className="space-y-2">
          {uploading ? (
            <div className="flex flex-col items-center">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-600 mt-2">Uploading...</p>
            </div>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-blue-600 hover:text-blue-500">
                  Click to upload
                </span>
                {' '}or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                {accept === '*/*' ? 'Any file type' : `Accepted: ${accept}`} • Max {maxSize}MB
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileUpload
