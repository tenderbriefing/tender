/**
 * Fail-soft checkout_started product event (behavioural only).
 * Must never run inside payment state transitions or mutate attendanceRequests.
 */
async function emitCheckoutStartedSafe({
  smeId,
  requestId,
  tenderId,
  checkoutId,
  province,
}: {
  smeId: string
  requestId: string
  tenderId?: string | null
  checkoutId?: string | null
  province?: string | null
}): Promise<void> {
  try {
    const productEvents = require('../../backend/services/productEventService.js')
    await productEvents.emitFunnelEventSafe(
      { uid: smeId, userType: 'sme', province: province || undefined },
      {
        eventName: 'checkout_started',
        feature: 'revenue_funnel',
        targetEntityType: 'attendanceRequest',
        targetEntityId: requestId,
        metadata: {
          requestId,
          tenderId: tenderId || '',
          checkoutId: checkoutId || '',
        },
      }
    )
  } catch {
    /* never block checkout */
  }
}

export { emitCheckoutStartedSafe }
