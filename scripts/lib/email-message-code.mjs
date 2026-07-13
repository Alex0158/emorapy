function splitMimePart(raw, contentType) {
  return raw
    .split(/\r?\n(?=--[^\r\n]+)/)
    .find((part) => new RegExp(`Content-Type:\\s*${contentType}`, 'i').test(part));
}

function decodeQuotedPrintable(value) {
  const unfolded = value.replace(/=\r?\n/g, '');
  const binary = unfolded.replace(/=([0-9A-F]{2})/gi, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  return Buffer.from(binary, 'binary').toString('utf8');
}

function decodeMimePart(part) {
  const separator = part.match(/\r?\n\r?\n/);
  if (!separator || separator.index === undefined) return '';

  const headers = part.slice(0, separator.index);
  const body = part.slice(separator.index + separator[0].length).replace(/\r?\n--[^\r\n]*$/, '');
  const encoding = headers
    .match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)?.[1]
    ?.trim()
    .toLowerCase();

  if (encoding === 'base64') {
    return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(body);
  if (!encoding || encoding === '7bit' || encoding === '8bit') return body;
  return '';
}

export function extractVerificationCodeFromMime(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const textPart = splitMimePart(raw, 'text/plain');
  if (!textPart) return null;
  const decoded = decodeMimePart(textPart);
  return decoded.match(/(?<!\d)(\d{6})(?!\d)/)?.[1] ?? null;
}
