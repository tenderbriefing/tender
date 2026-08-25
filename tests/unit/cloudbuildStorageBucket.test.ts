import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Cloud Run deploy env — Firebase Storage bucket', () => {
  const yaml = readFileSync(join(process.cwd(), 'cloudbuild.yaml'), 'utf8')

  it('sets FIREBASE_STORAGE_BUCKET for private-tender document uploads', () => {
    expect(yaml).toMatch(
      /FIREBASE_STORAGE_BUCKET=tenderbriefing-34679\.firebasestorage\.app/
    )
  })

  it('sets NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET to the same production bucket', () => {
    expect(yaml).toMatch(
      /NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-34679\.firebasestorage\.app/
    )
  })
})
