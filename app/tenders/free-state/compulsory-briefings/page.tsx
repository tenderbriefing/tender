import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('free-state')
export const generateMetadata = route.generateMetadata
export const revalidate = route.revalidate
export default route.default
