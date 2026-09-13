/** Map raw Supabase auth errors to something a person can act on. */
export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('pkce') || lower.includes('code verifier') || lower.includes('verifier')) {
    return 'That email link opened in a different browser than the app. Enter the code from the email here instead.'
  }
  if (
    lower.includes('only request this after') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return 'Wait a minute, then tap Resend. Too many tries pauses the email.'
  }
  if (
    lower.includes('error sending') ||
    lower.includes('failed to send') ||
    lower.includes('error occurred sending')
  ) {
    return 'The email did not go out. Wait a minute and tap Resend. Check Junk for an older code.'
  }
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return 'This email is not set up for Plate Pal yet.'
  }
  if (isLeftoverUnconfirmedAuthError(message)) {
    return leftoverUnconfirmedMessage
  }
  if (lower.includes('redirect') && (lower.includes('not allowed') || lower.includes('invalid') || lower.includes('not allowlisted'))) {
    return 'This app address is not allowed for sign-in email. Add it under Supabase Authentication → URL Configuration → Redirect URLs.'
  }
  return message
}

const leftoverUnconfirmedMessage =
  'This email started sign-in but never finished. Confirm or delete that user in Supabase Authentication → Users, then tap Email me a code again.'

/** Unconfirmed leftover from an earlier Confirm-email signup. OTP treats them as new and can refuse to send. */
export function isLeftoverUnconfirmedAuthError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('user_already_exists') ||
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed')
  )
}

/** After signInWithOtp fails, leftover accounts need a signup confirmation resend, not another new-user OTP. */
export function shouldResendSignupConfirmation(errorMessage: string | null | undefined): boolean {
  return typeof errorMessage === 'string' && isLeftoverUnconfirmedAuthError(errorMessage)
}

/** GoTrue only sends the email when a redirect URL is present. The template decides code vs link. */
export function authRedirectTo(origin: string): string {
  return `${origin.replace(/\/$/, '')}/login`
}

export function emailOtpRequestOptions(origin: string) {
  return {
    shouldCreateUser: true,
    emailRedirectTo: authRedirectTo(origin),
  }
}

const FRESH_OTP_MS = 2 * 60 * 1000

/** True when we just requested a code in this session, not when login was reopened later. */
export function isFreshOtpSend(sentAt: number | null | undefined, now = Date.now(), freshMs = FRESH_OTP_MS): boolean {
  return typeof sentAt === 'number' && Number.isFinite(sentAt) && now - sentAt >= 0 && now - sentAt < freshMs
}
