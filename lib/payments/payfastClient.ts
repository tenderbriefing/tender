'use client'

/**
 * Submit a PayFast hosted checkout form (POST to process URL).
 */
export function submitPayFastCheckout(
  formAction: string,
  fields: Record<string, string>
) {
  if (typeof document === 'undefined') {
    throw new Error('PayFast checkout must run in the browser')
  }
  if (!formAction || !fields) {
    throw new Error('Missing PayFast formAction or fields')
  }

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = formAction
  form.style.display = 'none'

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = String(value)
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

export function startPayFastFromApiPayload(data: {
  formAction?: string
  fields?: Record<string, string>
  redirectUrl?: string | null
}) {
  if (data?.formAction && data?.fields) {
    submitPayFastCheckout(data.formAction, data.fields)
    return
  }
  if (data?.redirectUrl) {
    window.location.href = data.redirectUrl
    return
  }
  throw new Error('No PayFast checkout payload returned')
}
