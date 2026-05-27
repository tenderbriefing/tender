import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ResourceArticlePage from '@/components/seo/ResourceArticlePage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { RESOURCE_ARTICLE_MAP } from '@/lib/seo/resources'

export function generateStaticParams() {
  return Object.keys(RESOURCE_ARTICLE_MAP).map((slug) => ({ slug }))
}

export function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Metadata {
  const article = RESOURCE_ARTICLE_MAP[params.slug]
  if (!article) {
    return buildPageMetadata({
      title: 'Resource not found',
      description: 'Article not found.',
      path: `/resources/${params.slug}`,
      noIndex: true,
    })
  }

  return buildPageMetadata({
    title: article.title,
    description: article.metaDescription,
    path: `/resources/${params.slug}`,
    type: 'article',
    keywords: [
      'tender briefing South Africa',
      'compulsory tender briefings',
      article.title,
    ],
  })
}

export default function ResourceArticleRoute({
  params,
}: {
  params: { slug: string }
}) {
  const article = RESOURCE_ARTICLE_MAP[params.slug]
  if (!article) notFound()
  return <ResourceArticlePage article={article} />
}
