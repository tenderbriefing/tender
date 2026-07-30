import Image from 'next/image'
import Link from 'next/link'
import { Mail, MapPin } from 'lucide-react'
import WhatsAppIconLink from '@/components/ui/WhatsAppIconLink'
import { SUPPORT_EMAIL } from '@/lib/contact'

const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="TenderBriefing"
                width={192}
                height={128}
                className="h-12 w-auto"
              />
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
              South Africa&apos;s procurement intelligence platform for compulsory tender
              briefings — connecting SMEs with verified Youth Agents nationwide. Free for SMEs;
              R249 only when requesting a Youth Agent.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Platform
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <Link href="/tenders" className="hover:text-brand-400 transition">
                  Tender Opportunities
                </Link>
              </li>
              <li>
                <Link href="/compulsory-tender-briefings" className="hover:text-brand-400 transition">
                  Compulsory Briefings
                </Link>
              </li>
              <li>
                <Link href="/tender-briefing-agent" className="hover:text-brand-400 transition">
                  Briefing Agent
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-brand-400 transition">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-brand-400 transition">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-brand-400 transition">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-brand-400 transition">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Company
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <Link href="/about" className="hover:text-brand-400 transition">
                  About
                </Link>
              </li>
              <li>
                <Link href="/sme-solutions" className="hover:text-brand-400 transition">
                  SME Solutions
                </Link>
              </li>
              <li>
                <Link href="/youth-agents" className="hover:text-brand-400 transition">
                  Youth Agents
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-400 transition">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-400 transition">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-brand-400 transition">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-5 text-sm sm:justify-between">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 hover:text-brand-400 transition"
          >
            <Mail className="h-4 w-4 text-brand-500" />
            <span>{SUPPORT_EMAIL}</span>
          </a>

          <WhatsAppIconLink className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#1ebe57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]" />

          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <span>Midrand, Gauteng, South Africa</span>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} TenderBriefing. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
