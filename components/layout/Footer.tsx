import Image from 'next/image'
import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'

const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <Image
                src="/icon.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <span className="text-xl font-bold text-white">
                Tender<span className="text-accent-400">Briefing</span>
              </span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              South Africa&apos;s procurement intelligence platform for compulsory tender
              briefings — connecting SMEs with verified Youth Agents nationwide. Free for SMEs;
              R249 only when requesting a Youth Agent.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Platform
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
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
              SEO Guides
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/tender-briefings-south-africa" className="hover:text-brand-400 transition">
                  Tender Briefings SA
                </Link>
              </li>
              <li>
                <Link href="/youth-agent-tender-support" className="hover:text-brand-400 transition">
                  Youth Agent Support
                </Link>
              </li>
              <li>
                <Link href="/tenders/gauteng" className="hover:text-brand-400 transition">
                  Gauteng Tenders
                </Link>
              </li>
              <li>
                <Link href="/tenders/western-cape" className="hover:text-brand-400 transition">
                  Western Cape Tenders
                </Link>
              </li>
              <li>
                <Link href="/rfq-briefing-support" className="hover:text-brand-400 transition">
                  RFQ Briefing Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Company
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
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

        <div className="mt-10 grid gap-4 border-t border-slate-800 pt-8 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-500" />
            <span>support@tenderbriefing.co.za</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-500" />
            <span>+27 10 013 3423</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <span>Midrand, Gauteng, South Africa</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} TenderBriefing. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
