import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('free-state')
export const generateMetadata = route.generateMetadata
export const dynamic = route.dynamic
export default route.default
