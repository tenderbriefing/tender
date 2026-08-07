import Image from 'next/image'
import Link from 'next/link'
import { Mail, MapPin } from 'lucide-react'
import WhatsAppIcon from '@/components/ui/WhatsAppIcon'
import { publicWhatsAppLink, SUPPORT_EMAIL } from '@/lib/contact'

const PLATFORM_LINKS = [
  { href: '/tenders', label: 'Tender Opportunities' },
  { href: '/compulsory-tender-briefings', label: 'Compulsory Briefings' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
] as const

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/youth-agents', label: 'Youth Agents' },
  { href: '/contact', label: 'Contact' },
  { href: '/support', label: 'Support' },
] as const

const linkClass =
  'text-[14px] leading-snug text-slate-300 transition hover:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

const headingClass =
  'text-[13px] font-semibold uppercase tracking-wider text-white sm:text-[14px]'

const Footer = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400">
              <Image
                src="/brand/logo.png"
                alt="TenderBriefing"
                width={130}
                height={87}
                unoptimized
                className="h-auto w-[110px] sm:w-[120px] lg:w-[130px]"
              />
            </Link>
            <p className="mt-2.5 text-[14px] leading-snug text-slate-400 line-clamp-3">
              Procurement intelligence connecting South African SMEs with tender
              opportunities and verified Youth Agents.
            </p>
          </div>

          {/* Platform */}
          <nav aria-label="Platform">
            <h3 className={headingClass}>Platform</h3>
            <ul className="mt-3 space-y-2">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label="Company">
            <h3 className={headingClass}>Company</h3>
            <ul className="mt-3 space-y-2">
              {COMPANY_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className={headingClass}>Contact</h3>
            <ul className="mt-3 space-y-2.5 text-[14px]">
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={`inline-flex items-center gap-2 ${linkClass}`}
                >
                  <Mail className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                  <span>{SUPPORT_EMAIL}</span>
                </a>
              </li>
              <li>
                <a
                  href={publicWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 ${linkClass}`}
                  aria-label="Chat on WhatsApp"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#25D366]" />
                  <span>WhatsApp</span>
                </a>
              </li>
              <li className="inline-flex items-start gap-2 text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <span>Midrand, Gauteng</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Utility bar */}
        <div className="mt-6 flex flex-col gap-2 border-t border-slate-800 pt-4 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-[13px]">
          <p>© {new Date().getFullYear()} TenderBriefing</p>
          <nav aria-label="Legal" className="flex items-center gap-2">
            <Link
              href="/privacy"
              className="transition hover:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Privacy
            </Link>
            <span aria-hidden className="text-slate-600">
              ·
            </span>
            <Link
              href="/terms"
              className="transition hover:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default Footer
