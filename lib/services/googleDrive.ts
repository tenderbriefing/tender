import { google } from 'googleapis';
import { environmentManager } from '@/lib/config/environment';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  shared?: boolean;
  owners?: Array<{
    displayName: string;
    emailAddress: string;
  }>;
  permissions?: Array<{
    id: string;
    type: string;
    role: string;
    emailAddress?: string;
  }>;
}

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
}

interface UploadOptions {
  name: string;
  parents?: string[];
  description?: string;
  mimeType?: string;
  convert?: boolean;
}

interface PermissionOptions {
  role: 'reader' | 'writer' | 'owner';
  type: 'user' | 'group' | 'domain' | 'anyone';
  emailAddress?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
}

class GoogleDriveService {
  private drive: any;
  private auth: any;
  private projectId: string = 'tenderbriefing-472813';

  constructor() {
    this.initializeDrive();
  }

  private async initializeDrive() {
    try {
      const config = await environmentManager.loadConfig();
      
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: this.projectId,
          private_key: config.googleCalendarPrivateKey.replace(/\\n/g, '\n'),
          client_email: config.googleCalendarClientEmail,
        },
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata',
          'https://www.googleapis.com/auth/drive.readonly'
        ]
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
    try {
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,parents,createdTime,modifiedTime',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        parents: response.data.parents,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
      };
    } catch (error: any) {
      console.error('Create folder error:', error);
      throw error;
    }
  }

  async uploadFile(
    file: Buffer | Uint8Array | string,
    options: UploadOptions
  ): Promise<DriveFile | null> {
    try {
      const fileMetadata = {
        name: options.name,
        parents: options.parents,
        description: options.description,
      };

      const media = {
        mimeType: options.mimeType || 'application/octet-stream',
        body: file,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        parents: response.data.parents,
        description: response.data.description,
      };
    } catch (error: any) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  async uploadBase64File(
    base64Data: string,
    options: UploadOptions
  ): Promise<DriveFile | null> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64String, 'base64');

      return this.uploadFile(fileBuffer, options);
    } catch (error: any) {
      console.error('Base64 upload error:', error);
      throw error;
    }
  }

  async getFile(fileId: string): Promise<DriveFile | null> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description,starred,trashed,shared,owners,permissions',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        parents: response.data.parents,
        description: response.data.description,
        starred: response.data.starred,
        trashed: response.data.trashed,
        shared: response.data.shared,
        owners: response.data.owners,
        permissions: response.data.permissions,
      };
    } catch (error: any) {
      console.error('Get file error:', error);
      return null;
    }
  }

  async listFiles(
    query?: string,
    pageSize: number = 100,
    pageToken?: string
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    try {
      const params: any = {
        pageSize,
        fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,description,starred,trashed,shared)',
      };

      if (query) {
        params.q = query;
      }

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await this.drive.files.list(params);

      const files: DriveFile[] = response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        parents: file.parents,
        description: file.description,
        starred: file.starred,
        trashed: file.trashed,
        shared: file.shared,
      }));

      return {
        files,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error: any) {
      console.error('List files error:', error);
      throw error;
    }
  }

  async searchFiles(query: string, pageSize: number = 100): Promise<DriveFile[]> {
    try {
      const result = await this.listFiles(query, pageSize);
      return result.files;
    } catch (error: any) {
      console.error('Search files error:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({
        fileId,
      });
      return true;
    } catch (error: any) {
      console.error('Delete file error:', error);
      return false;
    }
  }

  async updateFile(
    fileId: string,
    updates: {
      name?: string;
      description?: string;
      parents?: string[];
    }
  ): Promise<DriveFile | null> {
    try {
      const response = await this.drive.files.update({
        fileId,
        resource: updates,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,description',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        parents: response.data.parents,
        description: response.data.description,
      };
    } catch (error: any) {
      console.error('Update file error:', error);
      throw error;
    }
  }

  async shareFile(fileId: string, permission: PermissionOptions): Promise<boolean> {
    try {
      await this.drive.permissions.create({
        fileId,
        resource: permission,
      });
      return true;
    } catch (error: any) {
      console.error('Share file error:', error);
      return false;
    }
  }

  async getFileContent(fileId: string): Promise<Buffer | null> {
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
      }, { responseType: 'stream' });

      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.data.on('end', () => resolve(Buffer.concat(chunks)));
        response.data.on('error', reject);
      });
    } catch (error: any) {
      console.error('Get file content error:', error);
      return null;
    }
  }

  async createDocument(
    title: string,
    content?: string,
    parentId?: string
  ): Promise<DriveFile | null> {
    try {
      const fileMetadata = {
        name: title,
        parents: parentId ? [parentId] : undefined,
        mimeType: 'application/vnd.google-apps.document',
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,mimeType,webViewLink,parents',
      });

      // If content is provided, we would need to use the Google Docs API to add content
      // For now, we'll just return the created document

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        webViewLink: response.data.webViewLink,
        parents: response.data.parents,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Create document error:', error);
      throw error;
    }
  }

  async createSpreadsheet(
    title: string,
    parentId?: string
  ): Promise<DriveFile | null> {
    try {
      const fileMetadata = {
        name: title,
        parents: parentId ? [parentId] : undefined,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,mimeType,webViewLink,parents',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        webViewLink: response.data.webViewLink,
        parents: response.data.parents,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Create spreadsheet error:', error);
      throw error;
    }
  }

  // TenderConnect specific methods
  async createTenderFolder(tenderId: string, tenderTitle: string): Promise<DriveFolder | null> {
    try {
      // Create main tender folder
      const tenderFolder = await this.createFolder(`Tender: ${tenderTitle}`, undefined);
      if (!tenderFolder) return null;

      // Create subfolders
      await this.createFolder('Briefing Documents', tenderFolder.id);
      await this.createFolder('Audio Recordings', tenderFolder.id);
      await this.createFolder('Attendance Proof', tenderFolder.id);
      await this.createFolder('Connector Submissions', tenderFolder.id);

      return tenderFolder;
    } catch (error: any) {
      console.error('Create tender folder error:', error);
      throw error;
    }
  }

  async uploadTenderDocument(
    file: Buffer | Uint8Array | string,
    tenderId: string,
    documentType: 'briefing_notes' | 'audio_recording' | 'attendance_proof' | 'other',
    fileName: string,
    tenderFolderId?: string
  ): Promise<DriveFile | null> {
    try {
      const folderName = documentType === 'briefing_notes' ? 'Briefing Documents' :
                        documentType === 'audio_recording' ? 'Audio Recordings' :
                        documentType === 'attendance_proof' ? 'Attendance Proof' :
                        'Connector Submissions';

      // Find the appropriate folder
      let parentId = tenderFolderId;
      if (tenderFolderId) {
        const folders = await this.searchFiles(`'${tenderFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder'`);
        if (folders.length > 0) {
          parentId = folders[0].id;
        }
      }

      return this.uploadFile(file, {
        name: fileName,
        parents: parentId ? [parentId] : undefined,
        description: `Tender ${tenderId} - ${documentType}`,
      });
    } catch (error: any) {
      console.error('Upload tender document error:', error);
      throw error;
    }
  }

  async createTenderDocument(
    tenderId: string,
    documentType: 'briefing_notes' | 'summary' | 'report',
    title: string,
    tenderFolderId?: string
  ): Promise<DriveFile | null> {
    try {
      const folderName = documentType === 'briefing_notes' ? 'Briefing Documents' :
                        documentType === 'summary' ? 'Briefing Documents' :
                        'Connector Submissions';

      // Find the appropriate folder
      let parentId = tenderFolderId;
      if (tenderFolderId) {
        const folders = await this.searchFiles(`'${tenderFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder'`);
        if (folders.length > 0) {
          parentId = folders[0].id;
        }
      }

      return this.createDocument(title, undefined, parentId);
    } catch (error: any) {
      console.error('Create tender document error:', error);
      throw error;
    }
  }

  async shareTenderFolder(
    folderId: string,
    emailAddress: string,
    role: 'reader' | 'writer' = 'reader'
  ): Promise<boolean> {
    try {
      return this.shareFile(folderId, {
        role,
        type: 'user',
        emailAddress,
      });
    } catch (error: any) {
      console.error('Share tender folder error:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.drive !== null && this.auth !== null;
  }
}

export const googleDriveService = new GoogleDriveService();
