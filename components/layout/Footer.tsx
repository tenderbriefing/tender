import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'

const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
                <span className="font-bold text-white">TB</span>
              </div>
              <span className="text-xl font-bold text-white">TenderBriefing</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              South Africa&apos;s procurement intelligence platform for compulsory tender
              briefings — connecting SMEs with verified Youth Agents nationwide.
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
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-brand-400 transition">
                  About
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
