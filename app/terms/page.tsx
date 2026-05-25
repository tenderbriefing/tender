import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'TenderBriefing platform terms of service for SMEs and Youth Agents.',
}

export default function TermsPage() {
  return (
    <MarketingPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      description="Last updated for commercial pilot launch. By using TenderBriefing you agree to these terms."
    >
      <article className="prose prose-slate max-w-3xl prose-headings:text-slate-900 prose-a:text-brand-700">
        <h2>1. Platform scope</h2>
        <p>
          TenderBriefing provides tender discovery, compulsory briefing intelligence, Youth Agent
          coordination, and operational workflow tools. We do not submit tenders on your behalf
          and are not a government procurement authority.
        </p>

        <h2>2. SME responsibilities</h2>
        <p>
          SMEs remain solely responsible for reviewing tender documents, meeting all compulsory
          requirements, and submitting final bids through official government channels. Briefing
          reports are informational aids and do not guarantee tender success or compliance.
        </p>

        <h2>3. Youth Agent conduct</h2>
        <p>
          Agents must attend assigned briefings professionally, submit accurate reports on time,
          maintain confidentiality of SME information, and comply with venue rules. Misconduct,
          no-shows, or fraudulent reports may result in suspension and tier downgrade.
        </p>

        <h2>4. Payments and refunds</h2>
        <p>
          Briefing attendance support fees are quoted at checkout (standard fee R249.00 unless
          otherwise stated). Payment processing via Yoco may be enabled progressively during
          pilot. Refund policy: requests cancelled before agent dispatch may qualify for a
          refund review; no-shows by agents are escalated operationally. Full refund terms will
          be published before general availability.
        </p>

        <h2>5. Service levels</h2>
        <p>
          Dispatch, WhatsApp notifications, and report delivery targets are best-effort during
          pilot. SLA metrics are monitored internally and do not constitute a binding guarantee
          unless agreed in a written enterprise contract.
        </p>

        <h2>6. Data and accounts</h2>
        <p>
          You must provide accurate company, CSD, and contact information. You are responsible
          for safeguarding login credentials. See our Privacy Policy for POPIA-aligned data
          practices.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the extent permitted by law, TenderBriefing is not liable for missed deadlines,
          disqualification from tenders, agent unavailability, or errors in third-party tender
          data sourced from official publications.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these terms for pilot and commercial launch. Continued use after notice
          constitutes acceptance. Contact support@tenderbriefing.co.za for enquiries.
        </p>
      </article>
    </MarketingPageLayout>
  )
}
