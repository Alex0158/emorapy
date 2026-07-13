import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractVerificationCodeFromMime } from './email-message-code.mjs';

function messageWithTextPart({ encoding, body, recipient = 'claim-1783950508395@example.com' }) {
  return [
    `To: ${recipient}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="test-boundary"',
    '',
    '--test-boundary',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Transfer-Encoding: ${encoding}`,
    '',
    body,
    '--test-boundary--',
    '',
  ].join('\r\n');
}

test('extracts the verification code from a base64 text/plain MIME part', () => {
  const body = Buffer.from('您的驗證碼是：544081，有效期5分鐘。').toString('base64');
  const raw = messageWithTextPart({ encoding: 'base64', body });

  assert.equal(extractVerificationCodeFromMime(raw), '544081');
});

test('extracts the verification code from a quoted-printable text/plain MIME part', () => {
  const raw = messageWithTextPart({
    encoding: 'quoted-printable',
    body: 'Your verification code is 123456. It expires in 5 minutes.',
  });

  assert.equal(extractVerificationCodeFromMime(raw), '123456');
});

test('does not mistake envelope or recipient digits for a delivered code', () => {
  const raw = messageWithTextPart({
    encoding: '7bit',
    body: 'No verification code is present.',
  });

  assert.equal(extractVerificationCodeFromMime(raw), null);
});
