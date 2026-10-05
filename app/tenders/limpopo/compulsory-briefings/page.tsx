import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('limpopo')
export const generateMetadata = route.generateMetadata
export const dynamic = route.dynamic
export default route.default
