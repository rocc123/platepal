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
  return message
}

const FRESH_OTP_MS = 2 * 60 * 1000

/** True when we just requested a code in this session, not when login was reopened later. */
export function isFreshOtpSend(sentAt: number | null | undefined, now = Date.now(), freshMs = FRESH_OTP_MS): boolean {
  return typeof sentAt === 'number' && Number.isFinite(sentAt) && now - sentAt >= 0 && now - sentAt < freshMs
}
