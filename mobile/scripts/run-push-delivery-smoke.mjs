import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const options = {
  run: process.env.APP_PUSH_DELIVERY_SMOKE_RUN === 'true',
  expoPushToken: process.env.APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN || null,
  accessToken: process.env.APP_PUSH_DELIVERY_ACCESS_TOKEN || process.env.EXPO_PUSH_ACCESS_TOKEN || null,
  sendEndpoint: process.env.APP_PUSH_DELIVERY_SEND_ENDPOINT || 'https://exp.host/--/api/v2/push/send',
  receiptsEndpoint: process.env.APP_PUSH_DELIVERY_RECEIPTS_ENDPOINT || 'https://exp.host/--/api/v2/push/getReceipts',
  receiptAttempts: Number(process.env.APP_PUSH_DELIVERY_RECEIPT_ATTEMPTS || 6),
  receiptIntervalMs: Number(process.env.APP_PUSH_DELIVERY_RECEIPT_INTERVAL_MS || 10000),
  timeoutMs: Number(process.env.APP_PUSH_DELIVERY_TIMEOUT_MS || 30000),
  evidenceDir: path.join(repoRoot, 'docs/核心開發文件/90-證據與盤點/環境與發版驗證'),
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--run') {
    options.run = true;
  } else if (arg === '--dry-run') {
    options.run = false;
  } else if (arg.startsWith('--expo-push-token=')) {
    options.expoPushToken = arg.slice('--expo-push-token='.length);
  } else if (arg.startsWith('--access-token=')) {
    options.accessToken = arg.slice('--access-token='.length);
  } else if (arg.startsWith('--send-endpoint=')) {
    options.sendEndpoint = arg.slice('--send-endpoint='.length);
  } else if (arg.startsWith('--receipts-endpoint=')) {
    options.receiptsEndpoint = arg.slice('--receipts-endpoint='.length);
  } else if (arg.startsWith('--receipt-attempts=')) {
    options.receiptAttempts = Number(arg.slice('--receipt-attempts='.length));
  } else if (arg.startsWith('--receipt-interval-ms=')) {
    options.receiptIntervalMs = Number(arg.slice('--receipt-interval-ms='.length));
  } else if (arg.startsWith('--timeout-ms=')) {
    options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
  } else if (arg.startsWith('--evidence-dir=')) {
    options.evidenceDir = path.resolve(process.cwd(), arg.slice('--evidence-dir='.length));
  } else {
    console.error(`[push-delivery-smoke] unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function tokenKind(token) {
  if (token?.startsWith('ExpoPushToken[')) return 'ExpoPushToken';
  if (token?.startsWith('ExponentPushToken[')) return 'ExponentPushToken';
  return 'unknown';
}

function redactPushTokens(input) {
  return String(input || '').replace(/\b(?:Expo|Exponent)PushToken\[[^\]]+\]/g, '[push-token]');
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function normalizeRecord(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function normalizeTicket(input) {
  const record = normalizeRecord(input);
  const status = record.status === 'ok' || record.status === 'error' ? record.status : null;
  if (!status) return null;
  return {
    status,
    id: typeof record.id === 'string' ? record.id : null,
    message: typeof record.message === 'string' ? redactPushTokens(record.message).slice(0, 500) : null,
    details: normalizeRecord(record.details),
  };
}

function normalizeTickets(body) {
  const data = normalizeRecord(body).data;
  const rawTickets = Array.isArray(data) ? data : data ? [data] : [];
  return rawTickets.map(normalizeTicket).filter(Boolean);
}

function normalizeReceipt(input) {
  const record = normalizeRecord(input);
  const status = record.status === 'ok' || record.status === 'error' ? record.status : null;
  if (!status) return null;
  return {
    status,
    message: typeof record.message === 'string' ? redactPushTokens(record.message).slice(0, 500) : null,
    details: normalizeRecord(record.details),
  };
}

function normalizeReceipts(body) {
  const data = normalizeRecord(normalizeRecord(body).data);
  return Object.fromEntries(
    Object.entries(data)
      .map(([id, receipt]) => [id, normalizeReceipt(receipt)])
      .filter((entry) => Boolean(entry[1]))
  );
}

async function postJson(endpoint, payload, accessToken) {
  const startedAt = Date.now();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    duration_ms: Date.now() - startedAt,
    body,
    body_text_tail: redactPushTokens(text).slice(-1000),
  };
}

function writeEvidence(record) {
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const filePath = path.join(options.evidenceDir, `App-Push-Delivery-${safeTimestamp()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return filePath;
}

function buildBaseEvidence(app, startedAt) {
  return {
    type: 'app-push-provider-delivery-smoke',
    provider: 'expo',
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    working_directory: mobileRoot,
    node_version: process.version,
    app_android_package: app.android?.package,
    app_ios_bundle_identifier: app.ios?.bundleIdentifier,
    endpoints: {
      send_host: new URL(options.sendEndpoint).host,
      receipts_host: new URL(options.receiptsEndpoint).host,
    },
    access_token_present: Boolean(options.accessToken),
    push_token: options.expoPushToken
      ? {
          kind: tokenKind(options.expoPushToken),
          sha256: hashValue(options.expoPushToken),
          redacted: true,
        }
      : null,
    payload: {
      title: 'Emorapy notification smoke',
      body: 'Open Emorapy notifications',
      source_path: '/notifications',
      action_key: 'open_notifications',
      notification_id_prefix: 'app-push-smoke',
    },
  };
}

function printDryRun() {
  console.log('[push-delivery-smoke] dry-run');
  console.log('- Requires --run or APP_PUSH_DELIVERY_SMOKE_RUN=true before sending a provider push.');
  console.log('- Requires APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN or --expo-push-token=<ExpoPushToken[...]>.');
  console.log('- Optional APP_PUSH_DELIVERY_ACCESS_TOKEN / EXPO_PUSH_ACCESS_TOKEN or --access-token=<token> is never written to evidence.');
  console.log(`- Send endpoint host: ${new URL(options.sendEndpoint).host}`);
  console.log(`- Receipt endpoint host: ${new URL(options.receiptsEndpoint).host}`);
  console.log(`- Receipt polling: attempts=${options.receiptAttempts} intervalMs=${options.receiptIntervalMs}`);
}

async function run() {
  const startedAt = new Date().toISOString();
  const app = readJson(path.join(mobileRoot, 'app.json')).expo ?? {};
  if (!options.run) {
    printDryRun();
    return null;
  }

  const evidence = buildBaseEvidence(app, startedAt);
  if (!options.expoPushToken) {
    return {
      ...evidence,
      summary: {
        run_mode: 'run',
        provider_send_passed: false,
        ticket_accepted: false,
        receipt_checked: false,
        receipt_ok: false,
        blocked: true,
        failure: 'APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN or --expo-push-token is required.',
      },
    };
  }

  if (!['ExpoPushToken', 'ExponentPushToken'].includes(tokenKind(options.expoPushToken))) {
    return {
      ...evidence,
      summary: {
        run_mode: 'run',
        provider_send_passed: false,
        ticket_accepted: false,
        receipt_checked: false,
        receipt_ok: false,
        blocked: true,
        failure: 'Push token must start with ExpoPushToken[...] or ExponentPushToken[...].',
      },
    };
  }

  const message = {
    to: options.expoPushToken,
    title: evidence.payload.title,
    body: evidence.payload.body,
    sound: 'default',
    priority: 'high',
    data: {
      path: evidence.payload.source_path,
      action_key: evidence.payload.action_key,
      notification_id: `${evidence.payload.notification_id_prefix}-${Date.now()}`,
      source: 'app_release_push_delivery_smoke',
    },
  };

  const sendResponse = await postJson(options.sendEndpoint, [message], options.accessToken);
  const tickets = sendResponse.ok ? normalizeTickets(sendResponse.body) : [];
  const acceptedTicket = tickets.find((ticket) => ticket.status === 'ok' && ticket.id);
  const ticketIds = acceptedTicket?.id ? [acceptedTicket.id] : [];
  const receiptAttempts = [];
  let finalReceipt = null;

  for (let index = 0; index < options.receiptAttempts && ticketIds.length > 0; index += 1) {
    if (index > 0) wait(options.receiptIntervalMs);
    const receiptResponse = await postJson(options.receiptsEndpoint, { ids: ticketIds }, options.accessToken);
    const receipts = receiptResponse.ok ? normalizeReceipts(receiptResponse.body) : {};
    finalReceipt = receipts[acceptedTicket.id] ?? null;
    receiptAttempts.push({
      attempt: index + 1,
      status: receiptResponse.status,
      ok: receiptResponse.ok,
      duration_ms: receiptResponse.duration_ms,
      receipt_found: Boolean(finalReceipt),
      receipt_status: finalReceipt?.status ?? null,
      body_text_tail: receiptResponse.ok ? '' : receiptResponse.body_text_tail,
    });
    if (finalReceipt?.status === 'ok' || finalReceipt?.status === 'error') break;
  }

  const receiptOk = finalReceipt?.status === 'ok';
  return {
    ...evidence,
    summary: {
      run_mode: 'run',
      provider_send_passed: sendResponse.ok,
      ticket_accepted: Boolean(acceptedTicket),
      receipt_checked: receiptAttempts.length > 0,
      receipt_ok: receiptOk,
      blocked: !(sendResponse.ok && acceptedTicket && receiptOk),
    },
    provider_send: {
      status: sendResponse.status,
      ok: sendResponse.ok,
      duration_ms: sendResponse.duration_ms,
      body_text_tail: sendResponse.ok ? '' : sendResponse.body_text_tail,
    },
    tickets: tickets.map((ticket) => ({
      status: ticket.status,
      id_sha256: ticket.id ? hashValue(ticket.id) : null,
      message: ticket.message,
      details: ticket.details,
    })),
    receipts: finalReceipt
      ? [{
          ticket_id_sha256: acceptedTicket?.id ? hashValue(acceptedTicket.id) : null,
          status: finalReceipt.status,
          message: finalReceipt.message,
          details: finalReceipt.details,
        }]
      : [],
    receipt_attempts: receiptAttempts,
  };
}

try {
  const evidence = await run();
  if (!evidence) process.exit(0);

  const evidencePath = writeEvidence(evidence);
  console.log(`[push-delivery-smoke] evidence written: ${evidencePath}`);
  if (evidence.summary.blocked) {
    console.error('[push-delivery-smoke] failed: provider delivery did not reach accepted ticket plus ok receipt.');
    process.exit(1);
  }
  console.log('[push-delivery-smoke] ok: provider accepted ticket and returned ok receipt');
} catch (error) {
  const startedAt = new Date().toISOString();
  const app = fs.existsSync(path.join(mobileRoot, 'app.json'))
    ? readJson(path.join(mobileRoot, 'app.json')).expo ?? {}
    : {};
  const evidence = {
    ...buildBaseEvidence(app, startedAt),
    summary: {
      run_mode: options.run ? 'run' : 'dry-run',
      provider_send_passed: false,
      ticket_accepted: false,
      receipt_checked: false,
      receipt_ok: false,
      blocked: true,
      failure: redactPushTokens(error instanceof Error ? error.message : String(error)),
    },
  };
  const evidencePath = writeEvidence(evidence);
  console.error(`[push-delivery-smoke] evidence written: ${evidencePath}`);
  console.error(`[push-delivery-smoke] failed: ${evidence.summary.failure}`);
  process.exit(1);
}
