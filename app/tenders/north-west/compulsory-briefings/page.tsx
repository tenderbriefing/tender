import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('north-west')
export const generateMetadata = route.generateMetadata
export const dynamic = route.dynamic
export default route.default
