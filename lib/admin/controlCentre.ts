/**
 * Founder/admin control-centre information architecture.
 * Single source for module groups used by the dashboard and header nav alignment.
 */

export type AdminNavLink = {
  href: string
  label: string
  description?: string
  accent?: boolean
  founderOnly?: boolean
}

export type AdminNavGroup = {
  id: string
  label: string
  links: AdminNavLink[]
}

/** Full module catalogue for the control-centre Modules tab. */
export const ADMIN_CONTROL_CENTRE_MODULES: AdminNavGroup[] = [
  {
    id: 'operate',
    label: 'Operate',
    links: [
      {
        href: '/founder',
        label: 'Founder control centre',
        description: 'Pulse, intelligence, and interventions',
        accent: true,
        founderOnly: true,
      },
      {
        href: '/admin/registrations',
        label: 'Registrations',
        description: 'SME and Youth Agent directory',
      },
      {
        href: '/admin/operations',
        label: 'Operations',
        description: 'Attendance queue, automation, live board',
      },
      {
        href: '/admin/dispatch',
        label: 'Dispatch',
        description: 'Assign agents to briefings',
      },
      {
        href: '/admin/agents/performance',
        label: 'Agent performance',
        description: 'Reliability and completion metrics',
      },
      {
        href: '/admin/agent-workspace',
        label: 'Agent workspace',
        description: 'Oversight, audit, and verify',
      },
      {
        href: '/admin/procurement-inbox',
        label: 'RFQ inbox',
        description: 'Procurement email ingestion',
      },
    ],
  },
  {
    id: 'insight',
    label: 'Insight',
    links: [
      {
        href: '/admin/executive',
        label: 'Executive',
        description: 'Leadership summary metrics',
      },
      {
        href: '/admin/ai-insights',
        label: 'AI insights',
        description: 'Model-assisted ops signals',
      },
      {
        href: '/admin/procurement-intelligence',
        label: 'Procurement intel',
        description: 'Opportunity intelligence',
      },
      {
        href: '/admin/fraud',
        label: 'Fraud & disputes',
        description: 'Risk and dispute review',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    links: [
      {
        href: '/admin/finance',
        label: 'Finance',
        description: 'Revenue and reconciliation',
      },
      {
        href: '/admin/integrations',
        label: 'Integrations',
        description: 'PayFast, WhatsApp, and connectors',
      },
      {
        href: '/admin/scraping',
        label: 'Scraping',
        description: 'Enrichment scraper controls',
      },
      {
        href: '/admin/pilot',
        label: 'Pilot launch',
        description: 'Pilot tasks and outreach',
        accent: true,
      },
    ],
  },
]

export type ControlCentreTabId = 'overview' | 'people' | 'system' | 'modules'

export const CONTROL_CENTRE_TABS: { id: ControlCentreTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People' },
  { id: 'system', label: 'System' },
  { id: 'modules', label: 'Modules' },
]

export type PrimaryAction = {
  href: string
  label: string
  description: string
  action?: 'sync'
}

export const CONTROL_CENTRE_PRIMARY_ACTIONS: PrimaryAction[] = [
  {
    href: '/admin/procurement-inbox',
    label: 'Review RFQs',
    description: 'Procurement inbox',
  },
  {
    href: '/admin/operations',
    label: 'Assignments',
    description: 'Attendance & dispatch queue',
  },
  {
    href: '/admin/fraud',
    label: 'Disputes',
    description: 'Fraud and risk review',
  },
  {
    href: '/admin/integrations',
    label: 'Payments',
    description: 'PayFast & connectors',
  },
]

/** Header-safe subset — keep authenticated admin nav scannable. */
export const ADMIN_HEADER_NAV = [
  { name: 'Console', href: '/admin/dashboard' },
  { name: 'Operations', href: '/admin/operations' },
  { name: 'Registrations', href: '/admin/registrations' },
  { name: 'RFQ inbox', href: '/admin/procurement-inbox' },
  { name: 'Dispatch', href: '/admin/dispatch' },
  { name: 'Finance', href: '/admin/finance' },
  { name: 'Integrations', href: '/admin/integrations' },
] as const

/** Founder header: home first, then daily ops. Integrations stay in Console modules. */
export const FOUNDER_HEADER_NAV = [
  { name: 'Founder', href: '/founder' },
  { name: 'Console', href: '/admin/dashboard' },
  { name: 'Operations', href: '/admin/operations' },
  { name: 'Registrations', href: '/admin/registrations' },
  { name: 'RFQ inbox', href: '/admin/procurement-inbox' },
  { name: 'Dispatch', href: '/admin/dispatch' },
  { name: 'Finance', href: '/admin/finance' },
] as const

export function getAdminHeaderNav(opts: { showFounder: boolean }): ReadonlyArray<{
  name: string
  href: string
}> {
  return opts.showFounder ? FOUNDER_HEADER_NAV : ADMIN_HEADER_NAV
}

export function filterAdminModules(opts: {
  showFounder: boolean
}): AdminNavGroup[] {
  return ADMIN_CONTROL_CENTRE_MODULES.map((group) => ({
    ...group,
    links: group.links.filter((link) => (link.founderOnly ? opts.showFounder : true)),
  })).filter((group) => group.links.length > 0)
}

export type ClientFeatureFlagRow = {
  key: string
  label: string
  enabled: boolean
  note: string
}

/** Read-only client-visible flag advisory (never authoritative authz). */
export function getClientFeatureFlagSnapshot(): ClientFeatureFlagRow[] {
  const truthy = (v: string | undefined) => {
    if (!v) return false
    const s = v.trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'on'
  }

  return [
    {
      key: 'founder_user_intelligence',
      label: 'Founder User Intelligence',
      enabled: truthy(process.env.NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE),
      note: 'Client mirror — server FOUNDER_USER_INTELLIGENCE_ENABLED gates data',
    },
    {
      key: 'procurement_intelligence',
      label: 'Procurement Intelligence',
      enabled: truthy(process.env.NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED),
      note: 'Advisory UI only — server flag + pilot UIDs authorize',
    },
    {
      key: 'youth_agent_workspace_v1',
      label: 'Youth Agent Workspace',
      enabled: truthy(process.env.NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED),
      note: 'Advisory UI only — server flag + pilot UIDs authorize',
    },
  ]
}
