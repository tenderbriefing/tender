const {
  EmailShell,
  EmailTitle,
  EmailIntro,
  StatusBadge,
  DetailRow,
  DetailCard,
  PrimaryButton,
  InfoPanel,
  WarningPanel,
  SuccessPanel,
  NumberedList,
} = require('./components')
const {
  escapeHtml,
  firstName,
  absoluteUrl,
  formatMoneyCents,
  formatDateLabel,
  formatDateTimeLabel,
  sliceStr,
} = require('./utils')

function bookingRows(input = {}) {
  return [
    DetailRow('Customer', input.smeCompany || input.smeName),
    DetailRow('Tender', input.tenderTitle),
    DetailRow('Reference', input.tenderNumber),
    DetailRow('Issuer', input.department || input.issuer),
    DetailRow('Briefing date', input.briefingDateLabel || input.briefingDate),
    DetailRow('Time', input.briefingTime),
    DetailRow('Venue', input.briefingVenue),
    DetailRow('Attendance request', input.requestId),
    DetailRow('Payment', input.paymentLabel),
    DetailRow('Payment status', input.paymentStatus),
    DetailRow('Transaction ref', input.paymentReference),
  ]
    .filter(Boolean)
    .join('')
}

function buildSmeWelcomeEmail(input = {}, env) {
  const name = firstName(input.displayName)
  const company = sliceStr(input.companyName)
  const dashboardUrl = absoluteUrl('/sme/dashboard', env)
  const subject = 'Welcome to TenderBriefing'
  const introExtra = company
    ? ` Your account for <strong>${escapeHtml(company)}</strong> is ready.`
    : ''

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Welcome', 'success')}</p>
    ${EmailTitle('Welcome to TenderBriefing')}
    ${EmailIntro(`Hi ${escapeHtml(name)},${introExtra} You now have a clearer path to compulsory tender briefings — without losing a day on the road.`)}
    ${InfoPanel(
      'Your next steps',
      NumberedList([
        'Open your SME dashboard and explore live tenders with compulsory briefings.',
        'Request a verified Youth Agent to attend on your behalf.',
        'Receive structured attendance proof and a briefing report for bid decisions.',
      ])
    )}
    ${PrimaryButton(dashboardUrl, 'Go to my SME dashboard')}
  `

  const text = [
    `Hi ${name},`,
    '',
    `Welcome to TenderBriefing.${company ? ` Your account for ${company} is ready.` : ''}`,
    'You now have a clearer path to compulsory tender briefings.',
    '',
    'Next steps:',
    '1. Open your SME dashboard and explore live tenders with compulsory briefings.',
    '2. Request a verified Youth Agent to attend on your behalf.',
    '3. Receive structured attendance proof and a briefing report for bid decisions.',
    '',
    `Dashboard: ${dashboardUrl}`,
    '',
    'Questions? Email support@tenderbriefing.co.za',
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Your TenderBriefing SME account is ready.', bodyHtml, env }),
    text,
  }
}

function buildYouthAgentWelcomeEmail(input = {}, env) {
  const name = firstName(input.displayName)
  const onboardingUrl = absoluteUrl('/agent/onboarding', env)
  const dashboardUrl = absoluteUrl('/agent/dashboard', env)
  const subject = 'Welcome to TenderBriefing as a Youth Agent'

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Youth Agent', 'info')}</p>
    ${EmailTitle('Welcome, Youth Agent')}
    ${EmailIntro(`Hi ${escapeHtml(name)}, you've joined TenderBriefing's network of Youth Agents who help South African SMEs show up for compulsory tender briefings — professionally and on time.`)}
    ${InfoPanel(
      'How assignments work',
      NumberedList([
        'Receive an assignment.',
        'Review meeting details.',
        'Attend the tender briefing.',
        'Capture proof of attendance.',
        'Submit the meeting report.',
      ])
    )}
    ${PrimaryButton(onboardingUrl, 'Open Youth Agent Workspace')}
    <p style="margin:0 0 12px;font-size:14px;color:#64748B;">Already onboarded? <a href="${escapeHtml(dashboardUrl)}" style="color:#0F1E3D;font-weight:600;">Open your agent dashboard</a></p>
  `

  const text = [
    `Hi ${name},`,
    '',
    'Welcome to TenderBriefing as a Youth Agent.',
    '',
    'How assignments work:',
    '1. Receive an assignment.',
    '2. Review meeting details.',
    '3. Attend the tender briefing.',
    '4. Capture proof of attendance.',
    '5. Submit the meeting report.',
    '',
    `Onboarding: ${onboardingUrl}`,
    `Dashboard: ${dashboardUrl}`,
    '',
    'Questions? Email support@tenderbriefing.co.za',
  ].join('\n')

  return {
    subject,
    html: EmailShell({
      title: subject,
      preheader: 'Your Youth Agent journey starts here.',
      bodyHtml,
      env,
    }),
    text,
  }
}

function buildAttendancePaymentConfirmationEmail(input = {}, env) {
  const requestUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const fee = input.paymentLabel || formatMoneyCents(input.paymentAmount ?? input.quotedFee, input.currency)
  const subject = 'Attendance Request Confirmed — TenderBriefing'
  const rows = bookingRows({
    ...input,
    paymentLabel: `${fee} — Paid`,
    paymentStatus: 'Paid',
  })

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Payment received', 'success')}</p>
    ${EmailTitle('Your attendance request is confirmed')}
    ${EmailIntro('TenderBriefing will allocate a Youth Agent to attend the briefing or site meeting on your behalf.')}
    ${SuccessPanel(
      'What you will receive',
      `<ul style="margin:0;padding-left:18px;">
        <li style="margin-bottom:6px;">Confirmation once an agent is allocated</li>
        <li style="margin-bottom:6px;">Proof of attendance after the meeting</li>
        <li>Meeting report within 24 hours after the scheduled briefing (operational SLA)</li>
      </ul>`
    )}
    ${DetailCard('Booking details', rows)}
    ${PrimaryButton(requestUrl, 'View Attendance Request')}
  `

  const text = [
    'Payment received — attendance request confirmed',
    '',
    'TenderBriefing will allocate a Youth Agent to attend on your behalf.',
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Reference: ${input.tenderNumber || '—'}`,
    `Briefing: ${input.briefingDate || '—'} ${input.briefingTime || ''}`.trim(),
    `Venue: ${input.briefingVenue || '—'}`,
    `Request: ${input.requestId || '—'}`,
    `Payment: ${fee} — Paid`,
    '',
    `View request: ${requestUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Payment received. Your booking is confirmed.', bodyHtml, env }),
    text,
  }
}

function buildAgentAssignmentEmail(input = {}, env) {
  const assignmentUrl = absoluteUrl(
    `/agent/workspace/assignments/${encodeURIComponent(input.requestId || '')}`,
    env
  )
  const ref = input.tenderNumber || input.requestId || 'Assignment'
  const subject = `New TenderBriefing Assignment — ${ref}`.slice(0, 180)
  const dueLabel = input.reportDueAtLabel || (input.reportDueAt ? formatDateTimeLabel(input.reportDueAt) : null)

  const rows = [
    DetailRow('Assignment', input.requestId),
    DetailRow('Tender', input.tenderTitle),
    DetailRow('Reference', input.tenderNumber),
    DetailRow('Issuing organisation', input.department || input.issuer),
    DetailRow('Meeting type', input.meetingType || 'Compulsory briefing / site meeting'),
    DetailRow('Date', input.briefingDateLabel || input.briefingDate),
    DetailRow('Time', input.briefingTime),
    DetailRow('Venue', input.briefingVenue),
    DetailRow('Official contact', input.contactPerson),
    DetailRow('Instructions', input.briefingInstructions || input.notes),
    DetailRow('Reporting deadline', dueLabel),
  ]
    .filter(Boolean)
    .join('')

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('New assignment', 'info')}</p>
    ${EmailTitle('You have a new assignment')}
    ${EmailIntro(`Hi ${escapeHtml(firstName(input.agentName || input.displayName))}, a tender briefing has been assigned to you.`)}
    ${WarningPanel(
      'Action required',
      NumberedList([
        'Review the meeting details.',
        'Attend the correct briefing.',
        'Capture required attendance proof.',
        'Upload evidence in the workspace.',
        'Submit your meeting report before the deadline.',
      ])
    )}
    ${DetailCard('Assignment details', rows)}
    ${PrimaryButton(assignmentUrl, 'Open Assignment')}
  `

  const text = [
    'New TenderBriefing assignment',
    '',
    `Assignment: ${input.requestId || '—'}`,
    `Tender: ${input.tenderTitle || '—'}`,
    `Reference: ${input.tenderNumber || '—'}`,
    `Date: ${input.briefingDate || '—'} ${input.briefingTime || ''}`.trim(),
    `Venue: ${input.briefingVenue || '—'}`,
    dueLabel ? `Reporting deadline: ${dueLabel}` : null,
    '',
    'Action required:',
    '1. Review meeting details',
    '2. Attend the briefing',
    '3. Capture proof',
    '4. Upload evidence',
    '5. Submit report before the deadline',
    '',
    `Open assignment: ${assignmentUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'New assignment — action required.', bodyHtml, env }),
    text,
  }
}

function buildSmeAgentAllocatedEmail(input = {}, env) {
  const requestUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const subject = 'Agent Allocated to Your Tender Briefing'
  const rows = bookingRows({
    ...input,
    paymentLabel: undefined,
    paymentStatus: undefined,
    paymentReference: undefined,
  })

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Agent allocated', 'success')}</p>
    ${EmailTitle('A Youth Agent has been assigned')}
    ${EmailIntro('A Youth Agent has been assigned to attend the briefing on your behalf. Attendance evidence will become available after the meeting, and the briefing report will follow through the platform.')}
    ${DetailCard('Booking details', rows)}
    ${PrimaryButton(requestUrl, 'View Attendance Request')}
  `

  const text = [
    'Agent allocated',
    '',
    'A Youth Agent has been assigned to attend the briefing on your behalf.',
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Reference: ${input.tenderNumber || '—'}`,
    `Date: ${input.briefingDate || '—'} ${input.briefingTime || ''}`.trim(),
    `Venue: ${input.briefingVenue || '—'}`,
    `Request: ${input.requestId || '—'}`,
    '',
    `View request: ${requestUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Your Youth Agent has been allocated.', bodyHtml, env }),
    text,
  }
}

function buildAttendanceProofAvailableEmail(input = {}, env) {
  const proofUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const ref = input.tenderNumber || input.requestId || ''
  const subject = `Proof of Attendance Available — ${ref}`.slice(0, 180)
  const rows = [
    DetailRow('Tender', input.tenderTitle),
    DetailRow('Reference', input.tenderNumber),
    DetailRow('Meeting date', input.briefingDateLabel || input.briefingDate),
    DetailRow('Assignment', input.requestId),
    DetailRow('Attendance status', input.attendanceStatus || 'Confirmed'),
  ]
    .filter(Boolean)
    .join('')

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Attendance confirmed', 'success')}</p>
    ${EmailTitle('Proof of attendance is available')}
    ${EmailIntro('TenderBriefing has recorded attendance for your booked briefing. Open the platform to review the evidence securely.')}
    ${DetailCard('Attendance', rows)}
    ${PrimaryButton(proofUrl, 'View Proof of Attendance')}
  `

  const text = [
    'Attendance confirmed — proof available',
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Reference: ${input.tenderNumber || '—'}`,
    `Meeting date: ${input.briefingDate || '—'}`,
    `Request: ${input.requestId || '—'}`,
    '',
    `View proof: ${proofUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Proof of attendance is ready to view.', bodyHtml, env }),
    text,
  }
}

function buildBriefingReportReadyEmail(input = {}, env) {
  const reportUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const ref = input.tenderNumber || input.requestId || ''
  const subject = `Tender Briefing Report Ready — ${ref}`.slice(0, 180)
  const rows = [
    DetailRow('Tender', input.tenderTitle),
    DetailRow('Reference', input.tenderNumber),
    DetailRow('Meeting date', input.briefingDateLabel || input.briefingDate),
    DetailRow('Report submitted', input.reportSubmittedAtLabel || formatDateTimeLabel(input.reportSubmittedAt)),
    DetailRow('Attendance request', input.requestId),
  ]
    .filter(Boolean)
    .join('')

  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Report ready', 'success')}</p>
    ${EmailTitle('Your tender briefing report is ready')}
    ${EmailIntro('The meeting report for your attendance request is available in TenderBriefing. Open the platform to review it securely — the full report is not attached to this email.')}
    ${DetailCard('Report', rows)}
    ${PrimaryButton(reportUrl, 'View Briefing Report')}
  `

  const text = [
    'Report ready',
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Reference: ${input.tenderNumber || '—'}`,
    `Meeting date: ${input.briefingDate || '—'}`,
    `Request: ${input.requestId || '—'}`,
    '',
    `View report: ${reportUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Your briefing report is ready.', bodyHtml, env }),
    text,
  }
}

function buildSmeClarificationAvailableEmail(input = {}, env) {
  const requestUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const subject = `Briefing clarification available — ${input.tenderTitle || 'TenderBriefing'}`.slice(0, 180)
  const bodyHtml = `
    ${EmailTitle('Clarification / addendum available')}
    ${EmailIntro(
      'A Founder-approved clarification has been added to your briefing service. This is a <strong>subsequent update</strong> — it does not rewrite your original approved briefing report.'
    )}
    ${DetailCard(
      'Update',
      [
        DetailRow('Title', input.title),
        DetailRow('Type', input.updateType || 'clarification'),
        DetailRow('Tender', input.tenderTitle),
        DetailRow('Reference', input.tenderNumber),
        DetailRow('Request', input.requestId),
      ]
        .filter(Boolean)
        .join('')
    )}
    ${InfoPanel('What changed', `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(String(input.content || '').slice(0, 1200))}</p>`)}
    ${PrimaryButton(requestUrl, 'View briefing history')}
  `
  const text = [
    subject,
    '',
    'A Founder-approved clarification was added (separate from the original report).',
    `Title: ${input.title || '—'}`,
    `Request: ${input.requestId || '—'}`,
    '',
    String(input.content || '').slice(0, 800),
    '',
    `Open: ${requestUrl}`,
  ].join('\n')
  return {
    subject,
    html: EmailShell({
      title: subject,
      preheader: 'A clarification was added to your briefing.',
      bodyHtml,
      env,
    }),
    text,
  }
}

function buildYaEvidenceCorrectionEmail(input = {}, env) {
  const assignmentUrl = absoluteUrl(
    `/agent/workspace/assignments/${encodeURIComponent(input.requestId || '')}`,
    env
  )
  const subject = 'Evidence correction required — TenderBriefing assignment'
  const bodyHtml = `
    ${EmailTitle('Please correct your briefing evidence')}
    ${EmailIntro(
      'Operations has requested a correction to your uploaded briefing evidence. Your original upload is retained for audit; please re-submit the required files.'
    )}
    ${WarningPanel(
      'Action required',
      `<p style="margin:0;">${escapeHtml(String(input.detail || 'Re-upload audio and/or attendance proof.').slice(0, 500))}</p>`
    )}
    ${DetailCard(
      'Assignment',
      [
        DetailRow('Tender', input.tenderTitle),
        DetailRow('Reference', input.tenderNumber),
        DetailRow('Request', input.requestId),
      ]
        .filter(Boolean)
        .join('')
    )}
    ${PrimaryButton(assignmentUrl, 'Open assignment')}
  `
  const text = [
    subject,
    '',
    String(input.detail || 'Re-upload evidence.'),
    `Request: ${input.requestId || '—'}`,
    `Open: ${assignmentUrl}`,
  ].join('\n')
  return {
    subject,
    html: EmailShell({
      title: subject,
      preheader: 'Evidence correction required.',
      bodyHtml,
      env,
    }),
    text,
  }
}

function buildAgentReportReminderEmail(input = {}, env) {
  const stage = String(input.stage || 'pending')
  const assignmentUrl = absoluteUrl(
    `/agent/workspace/assignments/${encodeURIComponent(input.requestId || '')}`,
    env
  )
  const dueLabel = input.reportDueAtLabel || formatDateTimeLabel(input.reportDueAt)

  let badge = StatusBadge('Report pending', 'info')
  let title = 'Submit your meeting report'
  let intro =
    'The briefing has concluded. Submit your report as soon as possible so the SME receives their briefing pack.'
  let subject = 'Report pending — TenderBriefing assignment'
  let panel = InfoPanel('Reminder', `<p style="margin:0;">Please submit your meeting report for this assignment.</p>`)

  if (stage === 'due_soon') {
    badge = StatusBadge('Due soon', 'warning')
    title = 'Your report deadline is approaching'
    intro = `Please submit your meeting report before <strong>${escapeHtml(dueLabel)}</strong>.`
    subject = 'Report due soon — TenderBriefing assignment'
    panel = WarningPanel('Deadline approaching', `<p style="margin:0;">Deadline: <strong>${escapeHtml(dueLabel)}</strong></p>`)
  } else if (stage === 'overdue') {
    badge = StatusBadge('Overdue', 'error')
    title = 'Report deadline passed'
    intro =
      'The report deadline has passed and this assignment needs immediate attention. Please submit your meeting report as soon as you can.'
    subject = 'Report overdue — TenderBriefing assignment'
    panel = WarningPanel(
      'Overdue',
      `<p style="margin:0;">Deadline was <strong>${escapeHtml(dueLabel)}</strong>. Please submit the report now.</p>`
    )
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;">${badge}</p>
    ${EmailTitle(title)}
    ${EmailIntro(intro)}
    ${panel}
    ${DetailCard(
      'Assignment',
      [
        DetailRow('Tender', input.tenderTitle),
        DetailRow('Reference', input.tenderNumber),
        DetailRow('Request', input.requestId),
        DetailRow('Deadline', dueLabel),
      ]
        .filter(Boolean)
        .join('')
    )}
    ${PrimaryButton(assignmentUrl, 'Submit Meeting Report')}
  `

  const text = [
    subject,
    '',
    intro.replace(/<[^>]+>/g, ''),
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Request: ${input.requestId || '—'}`,
    `Deadline: ${dueLabel || '—'}`,
    '',
    `Submit report: ${assignmentUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: subject, bodyHtml, env }),
    text,
  }
}

function buildReportDelayUpdateEmail(input = {}, env) {
  const requestUrl = absoluteUrl(`/sme/requests/${encodeURIComponent(input.requestId || '')}`, env)
  const subject = 'Update on Your Tender Briefing Report'
  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Update', 'warning')}</p>
    ${EmailTitle('Your briefing report is still being finalised')}
    ${EmailIntro('We are following up on your meeting report. Attendance status is tracked in your request, and TenderBriefing is working to complete the report pack.')}
    ${DetailCard(
      'Current status',
      [
        DetailRow('Tender', input.tenderTitle),
        DetailRow('Reference', input.tenderNumber),
        DetailRow('Attendance', input.attendanceStatus || 'Recorded / in progress'),
        DetailRow('Request', input.requestId),
      ]
        .filter(Boolean)
        .join('')
    )}
    ${PrimaryButton(requestUrl, 'View Current Status')}
  `

  const text = [
    subject,
    '',
    'Your briefing report is still being finalised. TenderBriefing is following up.',
    '',
    `Tender: ${input.tenderTitle || '—'}`,
    `Request: ${input.requestId || '—'}`,
    '',
    `View status: ${requestUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'An update on your briefing report.', bodyHtml, env }),
    text,
  }
}

function buildAdminReportOverdueEmail(input = {}, env) {
  const adminUrl = absoluteUrl('/admin/operations', env)
  const subject = `[Overdue report] ${input.tenderNumber || input.requestId || 'Attendance request'}`.slice(0, 180)
  const bodyHtml = `
    <p style="margin:0 0 16px;">${StatusBadge('Report overdue', 'error')}</p>
    ${EmailTitle('Report SLA breach')}
    ${EmailIntro('A Youth Agent meeting report is overdue and needs operational follow-up.')}
    ${DetailCard(
      'Escalation details',
      [
        DetailRow('Request', input.requestId),
        DetailRow('Agent', input.agentName || input.agentId),
        DetailRow('Tender', input.tenderTitle),
        DetailRow('Meeting date', input.briefingDate),
        DetailRow('Deadline', input.reportDueAtLabel || formatDateTimeLabel(input.reportDueAt)),
        DetailRow('Overdue by', input.overdueLabel),
      ]
        .filter(Boolean)
        .join('')
    )}
    ${PrimaryButton(adminUrl, 'Open Operations')}
  `

  const text = [
    subject,
    '',
    `Request: ${input.requestId}`,
    `Agent: ${input.agentName || input.agentId || '—'}`,
    `Deadline: ${input.reportDueAt || '—'}`,
    `Overdue: ${input.overdueLabel || '—'}`,
    '',
    `Ops: ${adminUrl}`,
  ].join('\n')

  return {
    subject,
    html: EmailShell({ title: subject, preheader: 'Report SLA overdue — action needed.', bodyHtml, env }),
    text,
  }
}

const TEMPLATE_BUILDERS = {
  sme_welcome: buildSmeWelcomeEmail,
  youth_agent_welcome: buildYouthAgentWelcomeEmail,
  attendance_payment_confirmed: buildAttendancePaymentConfirmationEmail,
  agent_assignment: buildAgentAssignmentEmail,
  sme_agent_allocated: buildSmeAgentAllocatedEmail,
  attendance_proof_available: buildAttendanceProofAvailableEmail,
  briefing_report_ready: buildBriefingReportReadyEmail,
  sme_clarification_available: buildSmeClarificationAvailableEmail,
  ya_evidence_correction: buildYaEvidenceCorrectionEmail,
  agent_report_reminder: buildAgentReportReminderEmail,
  report_delay_update: buildReportDelayUpdateEmail,
  admin_report_overdue: buildAdminReportOverdueEmail,
}

function renderEmailTemplate(templateId, input = {}, env = process.env) {
  const builder = TEMPLATE_BUILDERS[templateId]
  if (!builder) throw new Error(`Unknown email template: ${templateId}`)
  return builder(input, env)
}

module.exports = {
  TEMPLATE_BUILDERS,
  renderEmailTemplate,
  buildSmeWelcomeEmail,
  buildYouthAgentWelcomeEmail,
  buildAttendancePaymentConfirmationEmail,
  buildAgentAssignmentEmail,
  buildSmeAgentAllocatedEmail,
  buildAttendanceProofAvailableEmail,
  buildBriefingReportReadyEmail,
  buildSmeClarificationAvailableEmail,
  buildYaEvidenceCorrectionEmail,
  buildAgentReportReminderEmail,
  buildReportDelayUpdateEmail,
  buildAdminReportOverdueEmail,
  formatDateLabel,
  formatDateTimeLabel,
}
