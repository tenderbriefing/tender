import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import {
  requireAdmin,
  isGuardResponse,
} from '@/lib/auth/apiGuards'
import { sendSupportTicketEmails } from '@/lib/services/supportEmail'

export const dynamic = 'force-dynamic'

function supportTicketService() {
  // Standalone Cloud Run copies backend/ to process.cwd(); relative requires from
  // compiled .next/server routes do not resolve to that tree.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(path.join(process.cwd(), 'backend/services/supportTicketService'))
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) {
      return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 })
    }

    const support = supportTicketService()
    const { searchParams } = new URL(request.url)

    if (user.userType === 'admin') {
      if (searchParams.get('stats') === 'true') {
        const stats = await support.getSupportStats()
        return NextResponse.json({ success: true, data: stats })
      }
      const tickets = await support.listTickets({
        status: searchParams.get('status') || undefined,
        category: searchParams.get('category') || undefined,
        search: searchParams.get('search') || undefined,
        openOnly: searchParams.get('openOnly') === 'true',
      })
      return NextResponse.json({ success: true, data: tickets })
    }

    const tickets = await support.listTickets({
      requesterUid: user.uid,
      status: searchParams.get('status') || undefined,
    })
    return NextResponse.json({ success: true, data: tickets })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tickets',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = await verifyApiUser(request.headers.get('authorization'))
    const support = supportTicketService()

    const ticket = await support.createTicket(
      {
        subject: body.subject,
        body: body.body || body.message,
        email: body.email,
        name: body.name,
        category: body.category,
        priority: body.priority,
        source: body.source || (user ? 'support' : 'contact'),
        relatedRequestId: body.relatedRequestId,
        relatedTenderId: body.relatedTenderId,
      },
      user
        ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            companyName: user.companyName,
            userType: user.userType,
          }
        : null
    )

    const messageBody =
      Array.isArray(ticket.messages) && ticket.messages[0]?.body
        ? ticket.messages[0].body
        : String(body.body || body.message || '')

    const emailResult = await sendSupportTicketEmails({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      requesterName: ticket.requesterName,
      requesterEmail: ticket.requesterEmail,
      body: messageBody,
      source: ticket.source,
    })

    return NextResponse.json(
      {
        success: true,
        data: ticket,
        acknowledgement:
          'Thank you — we have received your enquiry. You will receive a response within 24 hours.',
        email: {
          supportNotified: emailResult.supportEmailSent,
          acknowledgementSent: emailResult.acknowledgementEmailSent,
          // Surface soft-fail without failing the request (ticket is the source of truth)
          deferred: Boolean(emailResult.error),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create ticket',
      },
      { status: 400 }
    )
  }
}

/** Admin-only: unused import silence for re-export patterns */
void requireAdmin
void isGuardResponse
