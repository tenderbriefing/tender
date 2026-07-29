import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

type DocData = Record<string, unknown>

function toIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    const seconds = (value as { _seconds: number })._seconds
    return new Date(seconds * 1000).toISOString()
  }
  return null
}

function pickPhone(data: DocData): string {
  return String(
    data.whatsAppNumber ||
      data.whatsappNumber ||
      data.phoneNumber ||
      data.phone ||
      ''
  ).trim()
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function mapSme(id: string, data: DocData) {
  return {
    id,
    uid: id,
    userType: 'sme' as const,
    displayName: String(data.displayName || data.contactPerson || ''),
    companyName: String(data.companyName || ''),
    email: String(data.email || ''),
    phone: pickPhone(data),
    province: String(data.province || data.location || ''),
    city: String(data.city || ''),
    csdNumber: String(data.csdNumber || ''),
    categories: asStringArray(data.categories),
    onboardingCompleted: data.onboardingCompleted === true,
    createdAt: toIso(data.createdAt) || toIso(data.onboardingCompletedAt),
    updatedAt: toIso(data.updatedAt),
  }
}

function mapAgent(id: string, data: DocData) {
  const preferred = asStringArray(data.preferredServiceAreas)
  const areas = preferred.length ? preferred : asStringArray(data.preferredAreas)
  return {
    id,
    uid: id,
    userType: 'youth-agent' as const,
    displayName: String(data.displayName || data.name || data.fullName || ''),
    email: String(data.email || ''),
    phone: pickPhone(data),
    province: String(data.province || data.location || ''),
    city: String(data.city || ''),
    verificationStatus: String(data.verificationStatus || 'pending'),
    verified: data.verified === true || data.verificationStatus === 'verified',
    reliabilityScore: Number(data.reliabilityScore ?? 100),
    completedBriefingCount: Number(data.completedBriefingCount ?? 0),
    acceptedBriefingCount: Number(data.acceptedBriefingCount ?? 0),
    transportAvailable: data.transportAvailable !== false,
    preferredServiceAreas: areas,
    onboardingCompleted: data.onboardingCompleted === true,
    createdAt: toIso(data.createdAt) || toIso(data.onboardingCompletedAt),
    updatedAt: toIso(data.updatedAt),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) return unauthorizedResponse('Admin sign-in required')

    const db = getFirebaseAdmin().firestore()
    const [usersSnap, smesSnap, agentsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('smes').get(),
      db.collection('agents').get(),
    ])

    const smeById = new Map<string, DocData>()
    for (const doc of smesSnap.docs) {
      smeById.set(doc.id, doc.data() as DocData)
    }
    const agentById = new Map<string, DocData>()
    for (const doc of agentsSnap.docs) {
      agentById.set(doc.id, doc.data() as DocData)
    }

    const smes: ReturnType<typeof mapSme>[] = []
    const agents: ReturnType<typeof mapAgent>[] = []
    const seenSme = new Set<string>()
    const seenAgent = new Set<string>()

    for (const doc of usersSnap.docs) {
      const data = doc.data() as DocData
      const userType = data.userType
      if (userType === 'sme') {
        const role = smeById.get(doc.id) || {}
        seenSme.add(doc.id)
        smes.push(mapSme(doc.id, { ...role, ...data }))
      } else if (userType === 'youth-agent') {
        const role = agentById.get(doc.id) || {}
        seenAgent.add(doc.id)
        agents.push(mapAgent(doc.id, { ...data, ...role }))
      }
    }

    for (const doc of smesSnap.docs) {
      if (seenSme.has(doc.id)) continue
      smes.push(mapSme(doc.id, doc.data() as DocData))
    }

    for (const doc of agentsSnap.docs) {
      if (seenAgent.has(doc.id)) continue
      agents.push(mapAgent(doc.id, doc.data() as DocData))
    }

    const byNewest = (
      a: { createdAt?: string | null },
      b: { createdAt?: string | null }
    ) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()

    smes.sort(byNewest)
    agents.sort(byNewest)

    return NextResponse.json({
      success: true,
      data: {
        smes,
        agents,
        summary: {
          totalSmes: smes.length,
          totalAgents: agents.length,
          onboardedSmes: smes.filter((s) => s.onboardingCompleted).length,
          verifiedAgents: agents.filter((a) => a.verified).length,
          pendingAgents: agents.filter(
            (a) => String(a.verificationStatus || 'pending') === 'pending'
          ).length,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load registrations',
      },
      { status: 500 }
    )
  }
}
