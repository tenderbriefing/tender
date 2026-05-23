import { NextRequest, NextResponse } from 'next/server';
import { googleDriveService } from '@/lib/services/googleDrive';

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create-folder':
        const { folderName, parentId } = data;
        if (!folderName) {
          return NextResponse.json({
            success: false,
            message: 'Folder name is required'
          }, { status: 400 });
        }

        const folder = await googleDriveService.createFolder(folderName, parentId);
        return NextResponse.json({
          success: true,
          data: folder,
          message: 'Folder created successfully'
        });

      case 'upload-file':
        const { file, fileName, parentId: uploadParentId, description, mimeType } = data;
        if (!file || !fileName) {
          return NextResponse.json({
            success: false,
            message: 'File data and fileName are required'
          }, { status: 400 });
        }

        const uploadedFile = await googleDriveService.uploadBase64File(file, {
          name: fileName,
          parents: uploadParentId ? [uploadParentId] : undefined,
          description,
          mimeType,
        });

        return NextResponse.json({
          success: true,
          data: uploadedFile,
          message: 'File uploaded successfully'
        });

      case 'create-document':
        const { docTitle, docContent, docParentId } = data;
        if (!docTitle) {
          return NextResponse.json({
            success: false,
            message: 'Document title is required'
          }, { status: 400 });
        }

        const document = await googleDriveService.createDocument(docTitle, docContent, docParentId);
        return NextResponse.json({
          success: true,
          data: document,
          message: 'Document created successfully'
        });

      case 'create-spreadsheet':
        const { sheetTitle, sheetParentId } = data;
        if (!sheetTitle) {
          return NextResponse.json({
            success: false,
            message: 'Spreadsheet title is required'
          }, { status: 400 });
        }

        const spreadsheet = await googleDriveService.createSpreadsheet(sheetTitle, sheetParentId);
        return NextResponse.json({
          success: true,
          data: spreadsheet,
          message: 'Spreadsheet created successfully'
        });

      case 'create-tender-folder':
        const { tenderId, tenderTitle } = data;
        if (!tenderId || !tenderTitle) {
          return NextResponse.json({
            success: false,
            message: 'Tender ID and title are required'
          }, { status: 400 });
        }

        const tenderFolder = await googleDriveService.createTenderFolder(tenderId, tenderTitle);
        return NextResponse.json({
          success: true,
          data: tenderFolder,
          message: 'Tender folder created successfully'
        });

      case 'upload-tender-document':
        const { tenderFile, uploadTenderId, documentType, tenderFileName, tenderFolderId } = data;
        if (!tenderFile || !uploadTenderId || !documentType || !tenderFileName) {
          return NextResponse.json({
            success: false,
            message: 'File data, tenderId, documentType, and fileName are required'
          }, { status: 400 });
        }

        const tenderDocument = await googleDriveService.uploadTenderDocument(
          Buffer.from(tenderFile.replace(/^data:[^;]+;base64,/, ''), 'base64'),
          uploadTenderId,
          documentType,
          tenderFileName,
          tenderFolderId
        );

        return NextResponse.json({
          success: true,
          data: tenderDocument,
          message: 'Tender document uploaded successfully'
        });

      case 'create-tender-document':
        const { createTenderDocId, tenderDocType, tenderDocTitle, tenderDocFolderId } = data;
        if (!createTenderDocId || !tenderDocType || !tenderDocTitle) {
          return NextResponse.json({
            success: false,
            message: 'Tender ID, document type, and title are required'
          }, { status: 400 });
        }

        const tenderDoc = await googleDriveService.createTenderDocument(
          createTenderDocId,
          tenderDocType,
          tenderDocTitle,
          tenderDocFolderId
        );

        return NextResponse.json({
          success: true,
          data: tenderDoc,
          message: 'Tender document created successfully'
        });

      case 'share-file':
        const { fileId, emailAddress, role } = data;
        if (!fileId || !emailAddress) {
          return NextResponse.json({
            success: false,
            message: 'File ID and email address are required'
          }, { status: 400 });
        }

        const shareResult = await googleDriveService.shareFile(fileId, {
          role: role || 'reader',
          type: 'user',
          emailAddress,
        });

        return NextResponse.json({
          success: shareResult,
          message: shareResult ? 'File shared successfully' : 'Failed to share file'
        });

      case 'share-tender-folder':
        const { folderId, shareEmailAddress, shareRole } = data;
        if (!folderId || !shareEmailAddress) {
          return NextResponse.json({
            success: false,
            message: 'Folder ID and email address are required'
          }, { status: 400 });
        }

        const shareFolderResult = await googleDriveService.shareTenderFolder(
          folderId,
          shareEmailAddress,
          shareRole || 'reader'
        );

        return NextResponse.json({
          success: shareFolderResult,
          message: shareFolderResult ? 'Tender folder shared successfully' : 'Failed to share tender folder'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Google Drive API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the Drive request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'list-files':
        const query = searchParams.get('query') || undefined;
        const pageSize = parseInt(searchParams.get('pageSize') || '100');
        const pageToken = searchParams.get('pageToken') || undefined;

        const filesResult = await googleDriveService.listFiles(query, pageSize, pageToken);
        return NextResponse.json({
          success: true,
          data: filesResult.files,
          nextPageToken: filesResult.nextPageToken,
          message: 'Files listed successfully'
        });

      case 'search-files':
        const searchQuery = searchParams.get('query');
        const searchPageSize = parseInt(searchParams.get('pageSize') || '100');

        if (!searchQuery) {
          return NextResponse.json({
            success: false,
            message: 'Search query is required'
          }, { status: 400 });
        }

        const searchResults = await googleDriveService.searchFiles(searchQuery, searchPageSize);
        return NextResponse.json({
          success: true,
          data: searchResults,
          message: 'Search completed successfully'
        });

      case 'get-file':
        const fileId = searchParams.get('fileId');
        if (!fileId) {
          return NextResponse.json({
            success: false,
            message: 'File ID is required'
          }, { status: 400 });
        }

        const file = await googleDriveService.getFile(fileId);
        return NextResponse.json({
          success: true,
          data: file,
          message: file ? 'File retrieved successfully' : 'File not found'
        });

      case 'get-file-content':
        const contentFileId = searchParams.get('fileId');
        if (!contentFileId) {
          return NextResponse.json({
            success: false,
            message: 'File ID is required'
          }, { status: 400 });
        }

        const fileContent = await googleDriveService.getFileContent(contentFileId);
        if (fileContent) {
          return new NextResponse(fileContent as any, {
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Failed to retrieve file content'
          }, { status: 404 });
        }

      case 'status':
        const isConfigured = googleDriveService.isConfigured();
        return NextResponse.json({
          success: true,
          data: {
            configured: isConfigured,
            projectId: 'tenderbriefing-472813'
          },
          message: 'Google Drive service status retrieved'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified. Available actions: list-files, search-files, get-file, get-file-content, status'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Google Drive API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the Drive request'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { fileId, updates } = await request.json();

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: 'File ID is required'
      }, { status: 400 });
    }

    const updatedFile = await googleDriveService.updateFile(fileId, updates);
    return NextResponse.json({
      success: true,
      data: updatedFile,
      message: 'File updated successfully'
    });
  } catch (error: any) {
    console.error('Google Drive API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while updating the file'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: 'File ID is required'
      }, { status: 400 });
    }

    const deleteResult = await googleDriveService.deleteFile(fileId);
    return NextResponse.json({
      success: deleteResult,
      message: deleteResult ? 'File deleted successfully' : 'Failed to delete file'
    });
  } catch (error: any) {
    console.error('Google Drive API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while deleting the file'
    }, { status: 500 });
  }
}
