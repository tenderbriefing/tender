export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const

export type SaProvince = (typeof SA_PROVINCES)[number]

/** Stable URL slug — e.g. KwaZulu-Natal → kwazulu-natal */
export function provinceToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const PROVINCE_SLUG_TO_NAME: Record<string, SaProvince> = Object.fromEntries(
  SA_PROVINCES.map((p) => [provinceToSlug(p), p])
) as Record<string, SaProvince>

export const PROVINCE_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  SA_PROVINCES.map((p) => [p, provinceToSlug(p)])
)

export function provinceFromSlug(slug: string): SaProvince | null {
  return PROVINCE_SLUG_TO_NAME[slug.trim().toLowerCase()] ?? null
}
