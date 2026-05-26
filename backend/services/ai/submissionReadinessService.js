/**
 * Submission readiness — compliance docs, briefing attendance, risk checklist.
 */
const { persistInsight, nowIso, clamp } = require('./_shared')
const { getStorage } = require('../storageAdapter')
const COLLECTIONS = require('./autonomousCollections')

const COMPLIANCE_CHECKS = [
  { key: 'csd', label: 'CSD registration', field: 'csdRegistered' },
  { key: 'cidb', label: 'CIDB grading (construction)', field: 'cidbGrade' },
  { key: 'bbbee', label: 'BBBEE certificate', field: 'bbbeeLevel' },
  { key: 'tax', label: 'Tax clearance', field: 'taxClearanceValid' },
  { key: 'coida', label: 'COIDA / compensation fund', field: 'coidaCompliant' },
]

function assessCompliance(smeProfile = {}) {
  const missing = []
  const validated = []
  for (const check of COMPLIANCE_CHECKS) {
    const val = smeProfile[check.field] ?? smeProfile.compliance?.[check.key]
    if (val === true || (typeof val === 'string' && val.length > 0) || (typeof val === 'number' && val > 0)) {
      validated.push(check.key)
    } else {
      missing.push(check.label)
    }
  }
  const score = Math.round((validated.length / COMPLIANCE_CHECKS.length) * 100)
  return { validated, missing, complianceScore: score }
}

async function evaluateSubmissionReadiness(smeUid, tenderId = null) {
  const storage = getStorage()
  const db = require('../../config/firebaseAdmin').getFirestore()
  let smeProfile = {}
  try {
    const userSnap = await db.collection('users').doc(smeUid).get()
    if (userSnap.exists) smeProfile = userSnap.data()
  } catch {
    /* optional */
  }

  const compliance = assessCompliance(smeProfile)
  let tender = null
  let briefingAttended = null
  if (tenderId) {
    tender = await storage.getTenderBriefingById(tenderId)
    const requests = (await storage.getAttendanceRequests()).filter(
      (r) => r.smeId === smeUid && r.tenderId === tenderId
    )
    briefingAttended = requests.some((r) => r.status === 'completed')
  }

  const mandatoryDocs = []
  if (tender?.briefingCompulsory && briefingAttended === false) {
    mandatoryDocs.push('Compulsory briefing attendance not confirmed')
  }
  if (!compliance.validated.includes('tax')) mandatoryDocs.push('Valid tax clearance')
  if (!compliance.validated.includes('csd')) mandatoryDocs.push('Central Supplier Database (CSD)')

  const readinessScore = clamp(
    compliance.complianceScore * 0.6 +
      (briefingAttended === true ? 25 : briefingAttended === false ? 0 : 15) -
      mandatoryDocs.length * 8,
    0,
    100
  )

  let riskLevel = 'low'
  if (readinessScore < 40 || mandatoryDocs.length >= 3) riskLevel = 'high'
  else if (readinessScore < 65) riskLevel = 'medium'

  const report = {
    smeUid,
    tenderId,
    readinessScore,
    compliance,
    missingDocumentChecklist: [...compliance.missing, ...mandatoryDocs],
    briefingAttendanceStatus: briefingAttended,
    riskAssessment: { level: riskLevel, factors: mandatoryDocs },
    submissionRecommendations: [
      readinessScore >= 70
        ? 'Proceed with submission preparation'
        : 'Resolve compliance gaps before bidding',
      tender?.briefingCompulsory
        ? 'Ensure youth agent briefing attendance is completed'
        : 'Confirm briefing requirements on tender documents',
    ],
    generatedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  const docId = tenderId ? `${smeUid}_${tenderId}` : smeUid
  await persistInsight(COLLECTIONS.SUBMISSION_READINESS_REPORTS, docId, report)
  return report
}

module.exports = {
  evaluateSubmissionReadiness,
  assessCompliance,
  COLLECTION: COLLECTIONS.SUBMISSION_READINESS_REPORTS,
}
