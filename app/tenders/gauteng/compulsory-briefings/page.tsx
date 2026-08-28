import { createProvinceCompulsoryBriefingsPage } from '@/lib/seo/provinceHubRoute'

const route = createProvinceCompulsoryBriefingsPage('gauteng')
export const generateMetadata = route.generateMetadata
export const revalidate = route.revalidate
export default route.default
