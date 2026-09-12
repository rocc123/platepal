import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authRedirectTo, emailOtpRequestOptions, friendlyAuthError, isFreshOtpSend } from './authErrors.ts'

describe('friendlyAuthError', () => {
  it('explains a PKCE mismatch from an email link', () => {
    assert.equal(
      friendlyAuthError('invalid request: both auth code and code verifier should be non-empty'),
      'That email link opened in a different browser than the app. Enter the code from the email here instead.',
    )
  })

  it('explains a rate-limited resend', () => {
    assert.equal(
      friendlyAuthError('For security purposes, you can only request this after 42 seconds.'),
      'Wait a minute, then tap Resend. Too many tries pauses the email.',
    )
  })

  it('explains a send failure', () => {
    assert.equal(
      friendlyAuthError('Error sending confirmation email'),
      'The email did not go out. Wait a minute and tap Resend. Check Junk for an older code.',
    )
  })

  it('passes through an unknown message', () => {
    assert.equal(friendlyAuthError('Token has expired or is invalid'), 'Token has expired or is invalid')
  })

  it('explains a blocked redirect URL', () => {
    assert.equal(
      friendlyAuthError('redirect not allowed for this request'),
      'This app address is not allowed for sign-in email. Add it under Supabase Authentication → URL Configuration → Redirect URLs.',
    )
  })
})

describe('emailOtpRequestOptions', () => {
  it('sends a login redirect so Supabase actually emails the code', () => {
    assert.deepEqual(emailOtpRequestOptions('https://platepal-quavico.vercel.app'), {
      shouldCreateUser: true,
      emailRedirectTo: 'https://platepal-quavico.vercel.app/login',
    })
    assert.equal(authRedirectTo('https://app.example.com/'), 'https://app.example.com/login')
  })
})

describe('isFreshOtpSend', () => {
  const now = 1_700_000_000_000

  it('is true only for a send in the last two minutes', () => {
    assert.equal(isFreshOtpSend(now - 30_000, now), true)
    assert.equal(isFreshOtpSend(now - 3 * 60_000, now), false)
  })

  it('is false when login was restored with no send time', () => {
    assert.equal(isFreshOtpSend(null, now), false)
    assert.equal(isFreshOtpSend(undefined, now), false)
  })
})
