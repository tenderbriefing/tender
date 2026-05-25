/**
 * Pilot outreach message templates (from docs/LAUNCH_MESSAGES.md).
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://www.tenderbriefing.co.za'

function fill(template, vars) {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value ?? ''))
  }
  return out
}

const TEMPLATES = {
  sme_invitation: `Hi {{name}},

TenderBriefing helps South African SMEs never miss a *compulsory tender briefing*.

✅ Free tender discovery (official data, updated every 15 min)
✅ Request a verified Youth Agent to attend on your behalf
✅ Receive a structured briefing report for your bid team

Standard attendance support: R249 per briefing (pilot pricing).

Start here: {{link}}/pilot/sme

Questions? Reply here or email support@tenderbriefing.co.za

— TenderBriefing Team`,

  agent_recruitment: `Hi {{name}},

Join the TenderBriefing Youth Agent network and earn by attending compulsory tender briefings for SMEs.

✅ Register free — build your reliability score
✅ Receive nearby dispatch opportunities
✅ Upload digital briefing reports after each session

We verify agents during pilot. Transport and professionalism matter.

Register: {{link}}/pilot/agent

Code of conduct applies. More info: {{link}}/how-it-works

— TenderBriefing Operations`,

  follow_up: `Hi {{name}}, following up on TenderBriefing.

Have you found any compulsory briefings on the platform yet? If you share your province and sector, we can help you request your first attendance support.

Onboarding: {{link}}/sme/onboarding
Support: support@tenderbriefing.co.za`,

  reminder: `Hi {{name}},

Reminder: TenderBriefing pilot is open for {{leadType}} in {{province}}.

Complete your profile to receive briefing opportunities: {{link}}

— TenderBriefing`,

  pilot_acceptance: `Hi {{name}},

You have been accepted into the TenderBriefing pilot programme.

Next step: {{link}}

We will contact you for your first briefing assignment. Keep WhatsApp active for dispatch updates.

— TenderBriefing Operations`,
}

function buildMessage(messageType, lead = {}) {
  const template = TEMPLATES[messageType]
  if (!template) throw new Error(`Unknown message type: ${messageType}`)

  const link = SITE_URL.replace(/\/$/, '')
  const name = lead.name || lead.company || 'there'
  const leadType = lead.leadType === 'agent' ? 'Youth Agents' : 'SMEs'
  const province = lead.province || 'your province'

  return fill(template, { name, link, leadType, province })
}

function listMessageTypes() {
  return Object.keys(TEMPLATES)
}

module.exports = {
  SITE_URL,
  TEMPLATES,
  buildMessage,
  listMessageTypes,
}
