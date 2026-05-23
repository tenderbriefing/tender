import { Storage } from '@google-cloud/storage';
import { environmentManager } from '@/lib/config/environment';

interface UploadOptions {
  destination: string;
  metadata?: {
    contentType?: string;
    cacheControl?: string;
    metadata?: Record<string, string>;
  };
  resumable?: boolean;
  validation?: 'crc32c' | 'md5' | false;
}

interface FileMetadata {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  timeCreated: Date;
  updated: Date;
  etag: string;
  generation: string;
  metageneration: string;
  md5Hash: string;
  crc32c: string;
  downloadURL?: string;
}

interface UploadResult {
  success: boolean;
  file?: FileMetadata;
  error?: string;
  publicUrl?: string;
}

class GoogleCloudStorageService {
  private storage!: Storage;
  private bucketName: string = 'tenderbriefing';
  private projectId: string = 'tenderbriefing-472813';

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      // Initialize with service account credentials
      this.storage = new Storage({
        projectId: this.projectId,
        // Credentials will be loaded from environment or service account
      });
    } catch (error) {
      console.error('Failed to initialize Google Cloud Storage:', error);
      throw error;
    }
  }

  async uploadFile(
    file: Buffer | Uint8Array | string,
    fileName: string,
    options: Partial<UploadOptions> = {}
  ): Promise<UploadResult> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileUpload = bucket.file(options.destination || fileName);

      const uploadOptions = {
        metadata: {
          contentType: options.metadata?.contentType || 'application/octet-stream',
          cacheControl: options.metadata?.cacheControl || 'public, max-age=3600',
          metadata: options.metadata?.metadata || {},
        },
        resumable: options.resumable !== false,
        validation: options.validation || 'crc32c',
      };

      await fileUpload.save(file, uploadOptions);

      // Make file public if needed
      if (options.metadata?.metadata?.public === 'true') {
        await fileUpload.makePublic();
      }

      const [metadata] = await fileUpload.getMetadata();
      const publicUrl = options.metadata?.metadata?.public === 'true' 
        ? `https://storage.googleapis.com/${this.bucketName}/${fileUpload.name}`
        : undefined;

      return {
        success: true,
        file: {
          name: metadata.name || fileName,
          bucket: metadata.bucket || this.bucketName,
          size: parseInt(String(metadata.size || '0')),
          contentType: metadata.contentType || 'application/octet-stream',
          timeCreated: new Date(metadata.timeCreated || new Date().toISOString()),
          updated: new Date(metadata.updated || new Date().toISOString()),
          etag: metadata.etag || '',
          generation: String(metadata.generation || ''),
          metageneration: String(metadata.metageneration || ''),
          md5Hash: metadata.md5Hash || '',
          crc32c: metadata.crc32c || '',
          downloadURL: publicUrl,
        },
        publicUrl,
      };
    } catch (error: any) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error.message || 'Upload failed',
      };
    }
  }

  async uploadBase64File(
    base64Data: string,
    fileName: string,
    contentType: string,
    options: Partial<UploadOptions> = {}
  ): Promise<UploadResult> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64String, 'base64');

      return this.uploadFile(fileBuffer, fileName, {
        ...options,
        metadata: {
          ...options.metadata,
          contentType,
        },
      });
    } catch (error: any) {
      console.error('Base64 upload error:', error);
      return {
        success: false,
        error: error.message || 'Base64 upload failed',
      };
    }
  }

  async deleteFile(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      await file.delete();
      
      return { success: true };
    } catch (error: any) {
      console.error('File deletion error:', error);
      return {
        success: false,
        error: error.message || 'File deletion failed',
      };
    }
  }

  async getFileMetadata(fileName: string): Promise<FileMetadata | null> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      const [metadata] = await file.getMetadata();
      
      return {
        name: metadata.name || '',
        bucket: metadata.bucket || this.bucketName,
        size: parseInt(String(metadata.size || '0')),
        contentType: metadata.contentType || 'application/octet-stream',
        timeCreated: new Date(metadata.timeCreated || new Date().toISOString()),
        updated: new Date(metadata.updated || new Date().toISOString()),
        etag: metadata.etag || '',
        generation: String(metadata.generation || ''),
        metageneration: String(metadata.metageneration || ''),
        md5Hash: metadata.md5Hash || '',
        crc32c: metadata.crc32c || '',
      };
    } catch (error: any) {
      console.error('Get file metadata error:', error);
      return null;
    }
  }

  async listFiles(prefix: string = '', maxResults: number = 100): Promise<FileMetadata[]> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix,
        maxResults,
      });

      return files.map(file => ({
        name: file.name,
        bucket: this.bucketName,
        size: file.metadata.size ? parseInt(String(file.metadata.size)) : 0,
        contentType: file.metadata.contentType || 'application/octet-stream',
        timeCreated: new Date(file.metadata.timeCreated || new Date().toISOString()),
        updated: new Date(file.metadata.updated || new Date().toISOString()),
        etag: file.metadata.etag || '',
        generation: String(file.metadata.generation || ''),
        metageneration: String(file.metadata.metageneration || ''),
        md5Hash: file.metadata.md5Hash || '',
        crc32c: file.metadata.crc32c || '',
      }));
    } catch (error: any) {
      console.error('List files error:', error);
      return [];
    }
  }

  async generateSignedUrl(
    fileName: string,
    action: 'read' | 'write' | 'delete' = 'read',
    expires: Date = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  ): Promise<string | null> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const options = {
        version: 'v4' as const,
        action,
        expires,
      };

      const [signedUrl] = await file.getSignedUrl(options);
      return signedUrl;
    } catch (error: any) {
      console.error('Generate signed URL error:', error);
      return null;
    }
  }

  async makeFilePublic(fileName: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      await file.makePublic();
      
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
      
      return {
        success: true,
        publicUrl,
      };
    } catch (error: any) {
      console.error('Make file public error:', error);
      return {
        success: false,
        error: error.message || 'Failed to make file public',
      };
    }
  }

  async makeFilePrivate(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      await file.makePrivate();
      
      return { success: true };
    } catch (error: any) {
      console.error('Make file private error:', error);
      return {
        success: false,
        error: error.message || 'Failed to make file private',
      };
    }
  }

  // TenderConnect specific methods
  async uploadTenderDocument(
    file: Buffer | Uint8Array | string,
    tenderId: string,
    documentType: 'briefing_notes' | 'audio_recording' | 'attendance_proof' | 'other',
    fileName: string
  ): Promise<UploadResult> {
    const destination = `tenders/${tenderId}/${documentType}/${fileName}`;
    
    return this.uploadFile(file, fileName, {
      destination,
      metadata: {
        contentType: this.getContentType(fileName),
        metadata: {
          tenderId,
          documentType,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
  }

  async uploadUserDocument(
    file: Buffer | Uint8Array | string,
    userId: string,
    documentType: 'profile_image' | 'id_document' | 'certificate' | 'other',
    fileName: string
  ): Promise<UploadResult> {
    const destination = `users/${userId}/${documentType}/${fileName}`;
    
    return this.uploadFile(file, fileName, {
      destination,
      metadata: {
        contentType: this.getContentType(fileName),
        metadata: {
          userId,
          documentType,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
  }

  async uploadConnectorSubmission(
    file: Buffer | Uint8Array | string,
    submissionId: string,
    fileType: 'audio' | 'notes' | 'proof' | 'other',
    fileName: string
  ): Promise<UploadResult> {
    const destination = `submissions/${submissionId}/${fileType}/${fileName}`;
    
    return this.uploadFile(file, fileName, {
      destination,
      metadata: {
        contentType: this.getContentType(fileName),
        metadata: {
          submissionId,
          fileType,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
  }

  private getContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const contentTypes: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'ogg': 'audio/ogg',
      
      // Video
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      
      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
    };
    
    return contentTypes[extension || ''] || 'application/octet-stream';
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getProjectId(): string {
    return this.projectId;
  }
}

export const googleCloudStorageService = new GoogleCloudStorageService();
