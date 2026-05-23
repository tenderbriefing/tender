import { NextRequest, NextResponse } from 'next/server';
import { googleCloudStorageService } from '@/lib/services/googleCloudStorage';

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'upload':
        const { file, fileName, contentType, options } = data;
        if (!file || !fileName) {
          return NextResponse.json({
            success: false,
            message: 'File data and fileName are required'
          }, { status: 400 });
        }

        const uploadResult = await googleCloudStorageService.uploadBase64File(
          file,
          fileName,
          contentType || 'application/octet-stream',
          options || {}
        );

        return NextResponse.json({
          success: uploadResult.success,
          data: uploadResult.file,
          publicUrl: uploadResult.publicUrl,
          message: uploadResult.success ? 'File uploaded successfully' : uploadResult.error
        });

      case 'upload-tender-document':
        const { tenderFile, tenderId, documentType, tenderFileName } = data;
        if (!tenderFile || !tenderId || !documentType || !tenderFileName) {
          return NextResponse.json({
            success: false,
            message: 'File data, tenderId, documentType, and fileName are required'
          }, { status: 400 });
        }

        const tenderUploadResult = await googleCloudStorageService.uploadTenderDocument(
          Buffer.from(tenderFile.replace(/^data:[^;]+;base64,/, ''), 'base64'),
          tenderId,
          documentType,
          tenderFileName
        );

        return NextResponse.json({
          success: tenderUploadResult.success,
          data: tenderUploadResult.file,
          message: tenderUploadResult.success ? 'Tender document uploaded successfully' : tenderUploadResult.error
        });

      case 'upload-user-document':
        const { userFile, userId, userDocumentType, userFileName } = data;
        if (!userFile || !userId || !userDocumentType || !userFileName) {
          return NextResponse.json({
            success: false,
            message: 'File data, userId, documentType, and fileName are required'
          }, { status: 400 });
        }

        const userUploadResult = await googleCloudStorageService.uploadUserDocument(
          Buffer.from(userFile.replace(/^data:[^;]+;base64,/, ''), 'base64'),
          userId,
          userDocumentType,
          userFileName
        );

        return NextResponse.json({
          success: userUploadResult.success,
          data: userUploadResult.file,
          message: userUploadResult.success ? 'User document uploaded successfully' : userUploadResult.error
        });

      case 'upload-submission':
        const { submissionFile, submissionId, fileType, submissionFileName } = data;
        if (!submissionFile || !submissionId || !fileType || !submissionFileName) {
          return NextResponse.json({
            success: false,
            message: 'File data, submissionId, fileType, and fileName are required'
          }, { status: 400 });
        }

        const submissionUploadResult = await googleCloudStorageService.uploadConnectorSubmission(
          Buffer.from(submissionFile.replace(/^data:[^;]+;base64,/, ''), 'base64'),
          submissionId,
          fileType,
          submissionFileName
        );

        return NextResponse.json({
          success: submissionUploadResult.success,
          data: submissionUploadResult.file,
          message: submissionUploadResult.success ? 'Submission uploaded successfully' : submissionUploadResult.error
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Storage API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the storage request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'list':
        const prefix = searchParams.get('prefix') || '';
        const maxResults = parseInt(searchParams.get('maxResults') || '100');
        
        const files = await googleCloudStorageService.listFiles(prefix, maxResults);
        return NextResponse.json({
          success: true,
          data: files,
          message: 'Files listed successfully'
        });

      case 'metadata':
        const fileName = searchParams.get('fileName');
        if (!fileName) {
          return NextResponse.json({
            success: false,
            message: 'fileName parameter is required'
          }, { status: 400 });
        }

        const metadata = await googleCloudStorageService.getFileMetadata(fileName);
        return NextResponse.json({
          success: true,
          data: metadata,
          message: metadata ? 'File metadata retrieved successfully' : 'File not found'
        });

      case 'signed-url':
        const urlFileName = searchParams.get('fileName');
        const urlAction = searchParams.get('urlAction') as 'read' | 'write' | 'delete' || 'read';
        const expiresIn = parseInt(searchParams.get('expiresIn') || '900'); // 15 minutes default
        
        if (!urlFileName) {
          return NextResponse.json({
            success: false,
            message: 'fileName parameter is required'
          }, { status: 400 });
        }

        const expires = new Date(Date.now() + expiresIn * 1000);
        const signedUrl = await googleCloudStorageService.generateSignedUrl(urlFileName, urlAction, expires);
        
        return NextResponse.json({
          success: true,
          data: { signedUrl, expires },
          message: signedUrl ? 'Signed URL generated successfully' : 'Failed to generate signed URL'
        });

      case 'make-public':
        const publicFileName = searchParams.get('fileName');
        if (!publicFileName) {
          return NextResponse.json({
            success: false,
            message: 'fileName parameter is required'
          }, { status: 400 });
        }

        const publicResult = await googleCloudStorageService.makeFilePublic(publicFileName);
        return NextResponse.json({
          success: publicResult.success,
          data: { publicUrl: publicResult.publicUrl },
          message: publicResult.success ? 'File made public successfully' : publicResult.error
        });

      case 'make-private':
        const privateFileName = searchParams.get('fileName');
        if (!privateFileName) {
          return NextResponse.json({
            success: false,
            message: 'fileName parameter is required'
          }, { status: 400 });
        }

        const privateResult = await googleCloudStorageService.makeFilePrivate(privateFileName);
        return NextResponse.json({
          success: privateResult.success,
          message: privateResult.success ? 'File made private successfully' : privateResult.error
        });

      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            bucketName: googleCloudStorageService.getBucketName(),
            projectId: googleCloudStorageService.getProjectId(),
            configured: true
          },
          message: 'Google Cloud Storage service status retrieved'
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified. Available actions: list, metadata, signed-url, make-public, make-private, status'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Storage API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while processing the storage request'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({
        success: false,
        message: 'fileName parameter is required'
      }, { status: 400 });
    }

    const deleteResult = await googleCloudStorageService.deleteFile(fileName);
    return NextResponse.json({
      success: deleteResult.success,
      message: deleteResult.success ? 'File deleted successfully' : deleteResult.error
    });
  } catch (error: any) {
    console.error('Storage API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'An error occurred while deleting the file'
    }, { status: 500 });
  }
}
