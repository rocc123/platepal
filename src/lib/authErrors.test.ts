import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  authRedirectTo,
  emailOtpRequestOptions,
  friendlyAuthError,
  inboxHintForEmail,
  isFreshOtpSend,
  isLeftoverUnconfirmedAuthError,
  isMicrosoftInbox,
  isYahooInbox,
  otpRequestHint,
  otpSentFollowUp,
  shouldResendSignupConfirmation,
  strictInboxForEmail,
} from './authErrors.ts'

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
      'The email did not go out. Wait a minute and tap Resend. Check Junk, Spam, or Bulk for an older code.',
    )
  })

  it('passes through an unknown message', () => {
    assert.equal(friendlyAuthError('Token has expired or is invalid'), 'Token has expired or is invalid')
  })

  it('explains a leftover unconfirmed signup', () => {
    assert.equal(
      friendlyAuthError('User already registered'),
      'This email started sign-in but never finished. Confirm or delete that user in Supabase Authentication → Users, then tap Email me a code again.',
    )
    assert.equal(
      friendlyAuthError('Email not confirmed'),
      'This email started sign-in but never finished. Confirm or delete that user in Supabase Authentication → Users, then tap Email me a code again.',
    )
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

describe('leftover unconfirmed signup', () => {
  it('detects the GoTrue errors for an unfinished first-time email', () => {
    assert.equal(isLeftoverUnconfirmedAuthError('User already registered'), true)
    assert.equal(isLeftoverUnconfirmedAuthError('user_already_exists'), true)
    assert.equal(isLeftoverUnconfirmedAuthError('Email not confirmed'), true)
    assert.equal(isLeftoverUnconfirmedAuthError('Token has expired or is invalid'), false)
  })

  it('resends a signup confirmation only for those leftover errors', () => {
    assert.equal(shouldResendSignupConfirmation('User already registered'), true)
    assert.equal(shouldResendSignupConfirmation('Email not confirmed'), true)
    assert.equal(shouldResendSignupConfirmation('For security purposes, you can only request this after 42 seconds.'), false)
    assert.equal(shouldResendSignupConfirmation(null), false)
  })
})

describe('inbox provider hints', () => {
  it('treats Yahoo and AOL domains as Yahoo inboxes', () => {
    assert.equal(isYahooInbox('pat@yahoo.com'), true)
    assert.equal(isYahooInbox('pat@yahoo.co.uk'), true)
    assert.equal(isYahooInbox('pat@ymail.com'), true)
    assert.equal(isYahooInbox('pat@rocketmail.com'), true)
    assert.equal(isYahooInbox('pat@aol.com'), true)
    assert.equal(isYahooInbox('pat@gmail.com'), false)
    assert.equal(strictInboxForEmail('pat@yahoo.com'), 'yahoo')
  })

  it('treats Outlook and Hotmail domains as Microsoft inboxes', () => {
    assert.equal(isMicrosoftInbox('pat@outlook.com'), true)
    assert.equal(isMicrosoftInbox('pat@hotmail.co.uk'), true)
    assert.equal(isMicrosoftInbox('pat@live.com'), true)
    assert.equal(isMicrosoftInbox('pat@yahoo.com'), false)
    assert.equal(strictInboxForEmail('pat@live.com'), 'microsoft')
  })

  it('warns Yahoo addresses before and after a send', () => {
    assert.match(otpRequestHint('pat@yahoo.com'), /Spam and Bulk/)
    assert.match(otpSentFollowUp('pat@yahoo.com', true), /Spam or Bulk/)
    assert.match(otpSentFollowUp('pat@yahoo.com', false), /Spam and Bulk/)
    assert.match(inboxHintForEmail('pat@yahoo.com'), /Yahoo often hides/)
    assert.match(inboxHintForEmail('pat@outlook.com'), /Outlook and Hotmail/)
    assert.match(inboxHintForEmail('pat@gmail.com'), /Some inboxes hide/)
    assert.equal(
      otpRequestHint('pat@gmail.com'),
      'We email a number you type in this app. Home-screen installs cannot use an email link.',
    )
    assert.equal(otpSentFollowUp('pat@gmail.com', true), 'Type the number here — nothing to tap.')
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
