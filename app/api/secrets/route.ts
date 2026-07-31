import { NextRequest, NextResponse } from 'next/server';
import { secretManager } from '@/lib/secrets/secretManager';
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards';

/**
 * Admin secret manager metadata / rotation API.
 * Never returns plaintext secret values over HTTP.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (isGuardResponse(guard)) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'list': {
        const secrets = await secretManager.listSecrets();
        return NextResponse.json({
          success: true,
          data: secrets.map((name) => ({ name })),
          message: 'Secrets listed successfully'
        });
      }

      case 'get':
        return NextResponse.json({
          success: false,
          message: 'Plaintext secret retrieval over HTTP is disabled. Use list for metadata or rotate via POST.'
        }, { status: 403 });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Secret Manager API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred while processing the secret request'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (isGuardResponse(guard)) return guard;

  try {
    const { action, name, value } = await request.json();

    switch (action) {
      case 'create':
        if (!name || !value) {
          return NextResponse.json({
            success: false,
            message: 'Secret name and value are required'
          }, { status: 400 });
        }

        await secretManager.createSecret(name, value);
        return NextResponse.json({
          success: true,
          message: `Secret ${name} created successfully`
        });

      case 'update':
        if (!name || !value) {
          return NextResponse.json({
            success: false,
            message: 'Secret name and value are required'
          }, { status: 400 });
        }

        await secretManager.updateSecret(name, value);
        return NextResponse.json({
          success: true,
          message: `Secret ${name} updated successfully`
        });

      case 'delete':
        if (!name) {
          return NextResponse.json({
            success: false,
            message: 'Secret name is required'
          }, { status: 400 });
        }

        await secretManager.deleteSecret(name);
        return NextResponse.json({
          success: true,
          message: `Secret ${name} deleted successfully`
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Secret Manager API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred while processing the secret request'
    }, { status: 500 });
  }
}
