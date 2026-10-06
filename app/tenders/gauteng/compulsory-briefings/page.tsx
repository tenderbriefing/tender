import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('gauteng')
export const generateMetadata = route.generateMetadata
export const dynamic = 'force-dynamic'
export default route.default
