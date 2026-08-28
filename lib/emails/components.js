const { EMAIL_TOKENS: T } = require('./tokens')
const { escapeHtml, logoUrl, absoluteUrl } = require('./utils')

function BrandLogo({ env } = {}) {
  const src = logoUrl(env)
  return `
    <img src="${escapeHtml(src)}" width="160" height="107" alt="TenderBriefing"
      style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:160px;" />
  `.trim()
}

function EmailHeader({ env } = {}) {
  return `
    <tr>
      <td style="background:${T.surfaceDark};padding:20px 28px;border-radius:${T.radiusLarge} ${T.radiusLarge} 0 0;">
        ${BrandLogo({ env })}
      </td>
    </tr>
  `.trim()
}

function EmailTitle(text) {
  return `
    <h1 style="margin:0 0 12px;font-family:${T.fontStack};font-size:24px;line-height:1.3;font-weight:700;color:${T.textPrimary};">
      ${escapeHtml(text)}
    </h1>
  `.trim()
}

function EmailIntro(text) {
  return `
    <p style="margin:0 0 20px;font-family:${T.fontStack};font-size:16px;line-height:1.6;color:${T.textSecondary};">
      ${text}
    </p>
  `.trim()
}

const BADGE_STYLES = {
  success: { bg: T.successBg, color: T.success, border: T.successBorder },
  warning: { bg: T.warningBg, color: T.warning, border: T.warningBorder },
  error: { bg: T.errorBg, color: T.error, border: T.errorBorder },
  info: { bg: T.infoBg, color: T.info, border: T.infoBorder },
  neutral: { bg: T.surfaceMuted, color: T.textSecondary, border: T.border },
}

function StatusBadge(label, variant = 'info') {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.info
  return `
    <span style="display:inline-block;font-family:${T.fontStack};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${s.color};background:${s.bg};border:1px solid ${s.border};border-radius:999px;padding:6px 12px;line-height:1.2;">
      ${escapeHtml(label)}
    </span>
  `.trim()
}

function DetailRow(label, value) {
  if (value == null || value === '') return ''
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-family:${T.fontStack};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${T.textMuted};width:38%;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-family:${T.fontStack};font-size:15px;line-height:1.45;color:${T.textPrimary};vertical-align:top;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `.trim()
}

function DetailCard(title, rowsHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;background:${T.surfaceMuted};border:1px solid ${T.border};border-radius:${T.radiusMedium};">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 12px;font-family:${T.fontStack};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${T.primary};">
            ${escapeHtml(title)}
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>
  `.trim()
}

function PrimaryButton(href, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
      <tr>
        <td style="border-radius:${T.radiusMedium};background:${T.primary};">
          <a href="${escapeHtml(href)}"
             style="display:inline-block;font-family:${T.fontStack};font-size:15px;font-weight:600;color:${T.textOnDark};text-decoration:none;padding:14px 22px;min-height:44px;line-height:1.2;border-radius:${T.radiusMedium};">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim()
}

function SecondaryButton(href, label) {
  return `
    <p style="margin:0 0 16px;font-family:${T.fontStack};font-size:14px;color:${T.textSecondary};">
      <a href="${escapeHtml(href)}" style="color:${T.primary};font-weight:600;text-decoration:underline;">
        ${escapeHtml(label)}
      </a>
    </p>
  `.trim()
}

function InfoPanel(title, bodyHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;background:${T.infoBg};border:1px solid ${T.infoBorder};border-radius:${T.radiusMedium};">
      <tr>
        <td style="padding:16px 18px;font-family:${T.fontStack};color:${T.info};">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>
          <div style="font-size:14px;line-height:1.55;color:${T.textSecondary};">${bodyHtml}</div>
        </td>
      </tr>
    </table>
  `.trim()
}

function WarningPanel(title, bodyHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;background:${T.warningBg};border:1px solid ${T.warningBorder};border-radius:${T.radiusMedium};">
      <tr>
        <td style="padding:16px 18px;font-family:${T.fontStack};color:${T.warning};">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>
          <div style="font-size:14px;line-height:1.55;color:${T.textSecondary};">${bodyHtml}</div>
        </td>
      </tr>
    </table>
  `.trim()
}

function SuccessPanel(title, bodyHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;background:${T.successBg};border:1px solid ${T.successBorder};border-radius:${T.radiusMedium};">
      <tr>
        <td style="padding:16px 18px;font-family:${T.fontStack};color:${T.success};">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(title)}</p>
          <div style="font-size:14px;line-height:1.55;color:${T.textSecondary};">${bodyHtml}</div>
        </td>
      </tr>
    </table>
  `.trim()
}

function Divider() {
  return `<hr style="border:none;border-top:1px solid ${T.border};margin:8px 0 20px;" />`
}

function NumberedList(items) {
  const lis = (items || [])
    .map(
      (item, i) =>
        `<li style="margin:0 0 8px;"><span style="color:${T.textMuted};font-weight:600;margin-right:6px;">${i + 1}.</span>${escapeHtml(item)}</li>`
    )
    .join('')
  return `<ol style="margin:0;padding-left:4px;list-style:none;font-family:${T.fontStack};font-size:15px;line-height:1.5;color:${T.textSecondary};">${lis}</ol>`
}

function SupportFooter({ env } = {}) {
  const support = 'support@tenderbriefing.co.za'
  const site = absoluteUrl('/', env)
  return `
    <tr>
      <td style="padding:20px 28px 28px;border-top:1px solid ${T.border};font-family:${T.fontStack};font-size:12px;line-height:1.5;color:${T.textMuted};">
        Questions? Email <a href="mailto:${support}" style="color:${T.primary};">${support}</a><br />
        TenderBriefing · Midrand, Gauteng, South Africa<br />
        <a href="${escapeHtml(site)}" style="color:${T.textMuted};">${escapeHtml(site.replace(/^https?:\/\//, ''))}</a>
      </td>
    </tr>
  `.trim()
}

function SecurityNotice() {
  return `
    <p style="margin:0 0 12px;font-family:${T.fontStack};font-size:12px;line-height:1.45;color:${T.textMuted};">
      This is a transactional message from TenderBriefing about your account or booking.
      We will never ask you to share your password by email.
    </p>
  `.trim()
}

function EmailShell({ title, preheader, bodyHtml, env, includeSecurityNotice = true } = {}) {
  const pre = escapeHtml(preheader || title || '')
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title || 'TenderBriefing')}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${T.background};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${pre}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.background};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="max-width:${T.containerWidth};background:${T.surface};border:1px solid ${T.border};border-radius:${T.radiusLarge};overflow:hidden;">
          ${EmailHeader({ env })}
          <tr>
            <td style="padding:28px 28px 8px;font-family:${T.fontStack};">
              ${bodyHtml}
              ${includeSecurityNotice ? SecurityNotice() : ''}
            </td>
          </tr>
          ${SupportFooter({ env })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

module.exports = {
  BrandLogo,
  EmailHeader,
  EmailTitle,
  EmailIntro,
  StatusBadge,
  DetailRow,
  DetailCard,
  PrimaryButton,
  SecondaryButton,
  InfoPanel,
  WarningPanel,
  SuccessPanel,
  Divider,
  NumberedList,
  SupportFooter,
  SecurityNotice,
  EmailShell,
}
