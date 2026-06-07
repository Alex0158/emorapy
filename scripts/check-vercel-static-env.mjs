#!/usr/bin/env node

const [surface, baseUrl, expectedApiBaseUrl] = process.argv.slice(2);

if (!surface || !baseUrl || !expectedApiBaseUrl) {
  console.error('Usage: node scripts/check-vercel-static-env.mjs <surface> <base-url> <expected-api-base-url>');
  process.exit(1);
}

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');
const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
const normalizedExpectedApiBaseUrl = normalizeBaseUrl(expectedApiBaseUrl);

const assetUrlsFromHtml = (html) => {
  const urls = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gi)) {
    const src = match[1];
    urls.add(new URL(src, `${normalizedBaseUrl}/`).toString());
  }
  return [...urls];
};

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
};

try {
  const html = await fetchText(`${normalizedBaseUrl}/`);
  const assetUrls = assetUrlsFromHtml(html);

  if (assetUrls.length === 0) {
    throw new Error(`${surface} did not expose any JS asset scripts`);
  }

  let matchedAssetUrl = null;
  for (const assetUrl of assetUrls) {
    const js = await fetchText(assetUrl);
    if (js.includes(normalizedExpectedApiBaseUrl)) {
      matchedAssetUrl = assetUrl;
      break;
    }
  }

  if (!matchedAssetUrl) {
    throw new Error(`${surface} JS bundle does not contain expected API base URL: ${normalizedExpectedApiBaseUrl}`);
  }

  console.log(`[ok] ${surface} static bundle contains expected API base URL (${new URL(matchedAssetUrl).pathname})`);
  process.exit(0);
} catch (error) {
  console.error(`[error] ${surface} static env check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
