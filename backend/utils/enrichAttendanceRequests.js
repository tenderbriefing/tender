/**
 * Enrich attendance requests with tenderBriefings metadata (read-only, no duplicate writes).
 */

function tenderSnapshot(tender) {
  if (!tender) return null
  return {
    id: tender.id,
    tenderNumber: tender.tenderNumber || null,
    title: tender.title || null,
    department: tender.department || null,
    province: tender.province || null,
    category: tender.industrySector || tender.category || null,
    briefingDate: tender.briefingDate || null,
    briefingVenue: tender.briefingVenue || null,
    briefingTime: tender.briefingTime || null,
    closingDate: tender.closingDate || null,
    briefingCompulsory: Boolean(tender.briefingCompulsory),
    detailUrl: tender.detailUrl || null,
    documents: tender.documents || tender.documentUrls || null,
  }
}

/**
 * @param {import('../services/storageAdapter').StorageService} storage
 * @param {object[]} requests
 */
async function enrichAttendanceRequests(storage, requests) {
  if (!requests?.length) return []

  const uniqueIds = [...new Set(requests.map((r) => r.tenderId).filter(Boolean))]
  const tenderMap = new Map()

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const tender = await storage.getTenderBriefingById(id)
        if (tender) tenderMap.set(id, tender)
      } catch {
        tenderMap.set(id, null)
      }
    })
  )

  return requests.map((request) => {
    const tender = tenderMap.get(request.tenderId) || null
    const snapshot = tenderSnapshot(tender)

    return {
      ...request,
      tender: snapshot,
      tenderNumber: snapshot?.tenderNumber || request.tenderNumber,
      tenderTitle: snapshot?.title || request.tenderTitle,
      department: snapshot?.department || request.department,
      province: snapshot?.province || request.province,
      briefingVenue: snapshot?.briefingVenue || request.briefingVenue,
      briefingDate: snapshot?.briefingDate || request.briefingDate,
      briefingTime: snapshot?.briefingTime || request.briefingTime,
      closingDate: snapshot?.closingDate || request.closingDate,
      briefingCompulsory: snapshot?.briefingCompulsory ?? request.briefingCompulsory,
    }
  })
}

module.exports = {
  enrichAttendanceRequests,
  tenderSnapshot,
}
