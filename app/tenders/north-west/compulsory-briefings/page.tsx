import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('north-west')
export const generateMetadata = route.generateMetadata
export const dynamic = 'force-dynamic'
export default route.default
