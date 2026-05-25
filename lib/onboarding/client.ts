import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { sanitizeClientData } from '@/lib/auth/sanitize'
import type { UserProfile } from '@/lib/auth'

function nowIso() {
  return new Date().toISOString()
}

export interface SmeOnboardingInput {
  companyName: string
  csdNumber: string
  province: string
  categories: string[]
  preferredDepartments: string[]
  whatsAppNumber: string
  tenderInterests: string
}

export interface AgentOnboardingInput {
  displayName: string
  province: string
  city: string
  whatsAppNumber: string
  transportAvailable: boolean
  preferredServiceAreas: string[]
  idVerificationNote: string
  codeOfConductAccepted: boolean
}

export async function saveSmeOnboarding(
  uid: string,
  email: string,
  existing: Partial<UserProfile>,
  input: SmeOnboardingInput
) {
  const timestamp = nowIso()
  const profilePatch = sanitizeClientData({
    ...existing,
    uid,
    email,
    userType: 'sme' as const,
    companyName: input.companyName.trim(),
    csdNumber: input.csdNumber.trim(),
    province: input.province,
    categories: input.categories,
    sectors: input.categories,
    provincesOfInterest: [input.province],
    phoneNumber: input.whatsAppNumber.trim(),
    whatsAppNumber: input.whatsAppNumber.trim(),
    preferredDepartments: input.preferredDepartments,
    tenderInterests: input.tenderInterests.trim(),
    onboardingCompleted: true,
    onboardingCompletedAt: timestamp,
    updatedAt: timestamp,
  })

  await setDoc(doc(db, 'users', uid), profilePatch, { merge: true })
  await setDoc(
    doc(db, 'smes', uid),
    sanitizeClientData({
      id: uid,
      uid,
      email,
      displayName: existing.displayName || input.companyName,
      companyName: input.companyName.trim(),
      contactPerson: existing.displayName || '',
      csdNumber: input.csdNumber.trim(),
      province: input.province,
      categories: input.categories,
      sectors: input.categories,
      preferredDepartments: input.preferredDepartments,
      tenderInterests: input.tenderInterests.trim(),
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      provincesOfInterest: [input.province],
      userType: 'sme',
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    }),
    { merge: true }
  )
}

export async function saveAgentOnboarding(
  uid: string,
  email: string,
  existing: Partial<UserProfile>,
  input: AgentOnboardingInput
) {
  const timestamp = nowIso()
  const profilePatch = sanitizeClientData({
    ...existing,
    uid,
    email,
    userType: 'youth-agent' as const,
    displayName: input.displayName.trim(),
    province: input.province,
    city: input.city.trim(),
    location: `${input.city.trim()}, ${input.province}`,
    phoneNumber: input.whatsAppNumber.trim(),
    whatsAppNumber: input.whatsAppNumber.trim(),
    transportAvailable: input.transportAvailable,
    preferredServiceAreas: input.preferredServiceAreas.length
      ? input.preferredServiceAreas
      : [input.province],
    idVerificationNote: input.idVerificationNote.trim(),
    codeOfConductAccepted: input.codeOfConductAccepted,
    codeOfConductAcceptedAt: input.codeOfConductAccepted ? timestamp : undefined,
    onboardingCompleted: true,
    onboardingCompletedAt: timestamp,
    updatedAt: timestamp,
  })

  await setDoc(doc(db, 'users', uid), profilePatch, { merge: true })
  await setDoc(
    doc(db, 'agents', uid),
    sanitizeClientData({
      id: uid,
      uid,
      email,
      displayName: input.displayName.trim(),
      name: input.displayName.trim(),
      province: input.province,
      city: input.city.trim(),
      location: `${input.city.trim()}, ${input.province}`,
      phoneNumber: input.whatsAppNumber.trim(),
      whatsAppNumber: input.whatsAppNumber.trim(),
      transportAvailable: input.transportAvailable,
      preferredServiceAreas: input.preferredServiceAreas.length
        ? input.preferredServiceAreas
        : [input.province],
      idVerificationNote: input.idVerificationNote.trim(),
      codeOfConductAccepted: input.codeOfConductAccepted,
      verificationStatus: 'pending',
      userType: 'youth-agent',
      onboardingCompleted: true,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    }),
    { merge: true }
  )
}
