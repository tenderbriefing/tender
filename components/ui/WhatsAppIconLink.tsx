import { publicWhatsAppLink } from '@/lib/contact'
import WhatsAppIcon from '@/components/ui/WhatsAppIcon'

export default function WhatsAppIconLink({
  className = 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#1ebe57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]',
  iconClassName = 'h-5 w-5',
  message,
  label = 'Chat on WhatsApp',
}: {
  className?: string
  iconClassName?: string
  message?: string
  label?: string
}) {
  return (
    <a
      href={publicWhatsAppLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={className}
    >
      <WhatsAppIcon className={iconClassName} />
    </a>
  )
}
