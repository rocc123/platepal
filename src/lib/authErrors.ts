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
    return 'The email did not go out. Wait a minute and tap Resend. Check Junk, Spam, or Bulk for an older code.'
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

export type StrictInbox = 'yahoo' | 'microsoft' | null

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return ''
  return email.slice(at + 1).trim().toLowerCase()
}

function domainMatches(domain: string, exact: string[], prefixes: string[]): boolean {
  if (!domain) return false
  if (exact.includes(domain)) return true
  return prefixes.some((prefix) => domain === prefix || domain.startsWith(`${prefix}.`))
}

/** Yahoo, AOL, and the old Yahoo domains. They often hide or drop the default mailer. */
export function isYahooInbox(email: string): boolean {
  const domain = emailDomain(email)
  return domainMatches(domain, ['ymail.com', 'rocketmail.com', 'aol.com', 'aim.com'], ['yahoo'])
}

/** Outlook, Hotmail, Live, and MSN. They often file the default mailer under Junk. */
export function isMicrosoftInbox(email: string): boolean {
  const domain = emailDomain(email)
  return domainMatches(domain, ['msn.com'], ['outlook', 'hotmail', 'live'])
}

export function strictInboxForEmail(email: string): StrictInbox {
  if (isYahooInbox(email)) return 'yahoo'
  if (isMicrosoftInbox(email)) return 'microsoft'
  return null
}

/** Shown before a code is requested. Yahoo gets a stronger warning. */
export function otpRequestHint(email: string): string {
  if (strictInboxForEmail(email) === 'yahoo') {
    return 'Yahoo often hides or blocks this email. After you send, check Spam and Bulk. Type the number in this app — home-screen installs cannot use an email link.'
  }
  return 'We email a number you type in this app. Home-screen installs cannot use an email link.'
}

/** Second sentence after "a code is on its way" or "enter the last code". */
export function otpSentFollowUp(email: string, fresh: boolean): string {
  const inbox = strictInboxForEmail(email)
  if (fresh) {
    if (inbox === 'yahoo') {
      return 'Yahoo often files it under Spam or Bulk. Type the number here — nothing to tap.'
    }
    return 'Type the number here — nothing to tap.'
  }
  if (inbox === 'yahoo') {
    return 'If you do not have it, check Spam and Bulk, then tap Resend.'
  }
  return 'If you do not have it, check Junk, then tap Resend.'
}

/** Under the code field after a send. */
export function inboxHintForEmail(email: string): string {
  switch (strictInboxForEmail(email)) {
    case 'yahoo':
      return 'No code? Check Spam and Bulk. Yahoo often hides this email or blocks it.'
    case 'microsoft':
      return 'No code? Check Junk / Spam. Outlook and Hotmail often hide this email.'
    default:
      return 'No code? Check Junk / Spam. Some inboxes hide this email.'
  }
}
