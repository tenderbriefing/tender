type JsonLdData = Record<string, unknown> | Array<Record<string, unknown>>

interface JsonLdProps {
  data: JsonLdData
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
