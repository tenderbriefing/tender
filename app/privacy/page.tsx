import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'POPIA-aligned privacy policy for TenderBriefing.',
}

export default function PrivacyPage() {
  return (
    <MarketingPageLayout
      eyebrow="Legal"
      title="Privacy Policy (POPIA)"
      description="How TenderBriefing collects, uses, and protects personal information under the Protection of Personal Information Act."
    >
      <article className="prose prose-slate max-w-3xl prose-headings:text-slate-900 prose-a:text-brand-700">
        <h2>1. Responsible party</h2>
        <p>
          TenderBriefing (operated from South Africa) is responsible for processing personal
          information collected through this platform. Contact: support@tenderbriefing.co.za.
        </p>

        <h2>2. Information we collect</h2>
        <ul>
          <li>Account details: name, email, company name, CSD number, province, sectors</li>
          <li>Contact: phone and WhatsApp numbers for operational notifications</li>
          <li>Operational: attendance requests, briefing reports, payment references (not card data)</li>
          <li>Technical: authentication tokens, usage logs, and device tokens for push notifications</li>
        </ul>

        <h2>3. Purpose of processing</h2>
        <p>
          We process data to match SMEs with Youth Agents, deliver briefing reports, send
          WhatsApp and email updates, improve dispatch reliability, comply with audit
          requirements, and meet legal obligations.
        </p>

        <h2>4. Lawful basis</h2>
        <p>
          Processing is based on contract performance (service delivery), legitimate interest
          (platform security and analytics), and consent where required (e.g. marketing
          messages).
        </p>

        <h2>5. Sharing</h2>
        <p>
          SME contact details relevant to an assignment are shared with assigned Youth Agents.
          Payment data is handled by Yoco when enabled. Infrastructure providers (Google Cloud,
          Firebase, Twilio) process data under their agreements. We do not sell personal
          information.
        </p>

        <h2>6. Retention</h2>
        <p>
          Records are retained for operational, dispute, and legal purposes, then deleted or
          anonymized when no longer required.
        </p>

        <h2>7. Your rights</h2>
        <p>
          Under POPIA you may request access, correction, deletion, or objection to processing.
          Email support@tenderbriefing.co.za. You may lodge a complaint with the Information
          Regulator.
        </p>

        <h2>8. Security</h2>
        <p>
          We apply access controls, encrypted transport, role-based Firestore rules, and admin-only
          operational telemetry. No system is fully secure; report concerns promptly.
        </p>

        <h2>9. Cross-border processing</h2>
        <p>
          Some subprocessors may process data outside South Africa with appropriate safeguards
          as required by POPIA.
        </p>

        <h2>10. Updates</h2>
        <p>This policy may be updated for pilot and commercial launch. Check this page for the latest version.</p>
      </article>
    </MarketingPageLayout>
  )
}
