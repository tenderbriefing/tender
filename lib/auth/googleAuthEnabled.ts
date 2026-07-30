/**
 * Google Sign-In / Continue UI + client entry.
 * Fail-closed: only enabled when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is explicitly true.
 * Production Cloud Build ships false so email/password is the release PASS path.
 * Re-enable later: set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true at Docker build time
 * (cloudbuild.yaml --build-arg + Dockerfile ARG/ENV). Firebase Google provider
 * can stay enabled in console; hiding UI is enough for product PASS.
 */
export function isGoogleAuthEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
  return v === '1' || v === 'true' || v === 'yes'
}
