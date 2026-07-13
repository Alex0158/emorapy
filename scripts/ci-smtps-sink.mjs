#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import tls from 'node:tls';
import { extractVerificationCodeFromMime } from './lib/email-message-code.mjs';

const smtpPort = Number(process.env.SMTP_SINK_PORT || 2465);
const apiPort = Number(process.env.SMTP_SINK_API_PORT || 8025);
const username = process.env.SMTP_SINK_USER || 'emorapy-ci';
const password = process.env.SMTP_SINK_PASS || 'emorapy-ci-password';
const certPath = process.env.SMTP_SINK_CERT_PATH;
const keyPath = process.env.SMTP_SINK_KEY_PATH;

if (!certPath || !keyPath) {
  throw new Error('SMTP_SINK_CERT_PATH and SMTP_SINK_KEY_PATH are required');
}

const messages = [];

function parseAddress(command) {
  const match = command.match(/<([^>]+)>/);
  return match?.[1]?.trim().toLowerCase() || '';
}

function createSession(socket) {
  let buffer = '';
  let dataLines = null;
  let authenticated = false;
  let loginPhase = null;
  let envelopeFrom = '';
  let recipients = [];

  const reply = (line) => socket.write(`${line}\r\n`);

  const resetEnvelope = () => {
    envelopeFrom = '';
    recipients = [];
    dataLines = null;
  };

  const finishMessage = () => {
    const raw = `${dataLines.join('\r\n')}\r\n`;
    messages.push({
      id: messages.length + 1,
      receivedAt: new Date().toISOString(),
      envelopeFrom,
      recipients: [...recipients],
      raw,
      verificationCode: extractVerificationCodeFromMime(raw),
    });
    if (messages.length > 100) messages.shift();
    resetEnvelope();
    reply('250 2.0.0 message accepted for delivery');
  };

  const authenticatePlain = (encoded) => {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const [, suppliedUser = '', suppliedPass = ''] = decoded.split('\0');
      authenticated = suppliedUser === username && suppliedPass === password;
    } catch {
      authenticated = false;
    }
    reply(authenticated ? '235 2.7.0 authentication successful' : '535 5.7.8 authentication failed');
  };

  const handleLine = (line) => {
    if (dataLines) {
      if (line === '.') {
        finishMessage();
      } else {
        dataLines.push(line.startsWith('..') ? line.slice(1) : line);
      }
      return;
    }

    if (loginPhase === 'username') {
      const suppliedUser = Buffer.from(line, 'base64').toString('utf8');
      loginPhase = suppliedUser === username ? 'password' : 'reject-password';
      reply('334 UGFzc3dvcmQ6');
      return;
    }
    if (loginPhase === 'password' || loginPhase === 'reject-password') {
      const suppliedPass = Buffer.from(line, 'base64').toString('utf8');
      authenticated = loginPhase === 'password' && suppliedPass === password;
      loginPhase = null;
      reply(authenticated ? '235 2.7.0 authentication successful' : '535 5.7.8 authentication failed');
      return;
    }

    const [verb = '', ...args] = line.trim().split(/\s+/);
    const command = verb.toUpperCase();
    const argument = args.join(' ');

    switch (command) {
      case 'EHLO':
        reply('250-localhost');
        reply('250-AUTH PLAIN LOGIN');
        reply('250 SIZE 1048576');
        return;
      case 'HELO':
        reply('250 localhost');
        return;
      case 'AUTH': {
        const mechanism = (args.shift() || '').toUpperCase();
        const initial = args.join(' ');
        if (mechanism === 'PLAIN') {
          if (initial) authenticatePlain(initial);
          else reply('334');
          return;
        }
        if (mechanism === 'LOGIN') {
          loginPhase = 'username';
          reply('334 VXNlcm5hbWU6');
          return;
        }
        reply('504 5.5.4 unsupported authentication mechanism');
        return;
      }
      case 'MAIL':
        if (!authenticated) {
          reply('530 5.7.0 authentication required');
          return;
        }
        envelopeFrom = parseAddress(argument);
        recipients = [];
        reply('250 2.1.0 sender accepted');
        return;
      case 'RCPT': {
        if (!authenticated || !envelopeFrom) {
          reply('503 5.5.1 bad command sequence');
          return;
        }
        const recipient = parseAddress(argument);
        if (!recipient) {
          reply('501 5.1.3 invalid recipient');
          return;
        }
        recipients.push(recipient);
        reply('250 2.1.5 recipient accepted');
        return;
      }
      case 'DATA':
        if (!authenticated || !envelopeFrom || recipients.length === 0) {
          reply('503 5.5.1 bad command sequence');
          return;
        }
        dataLines = [];
        reply('354 end data with <CR><LF>.<CR><LF>');
        return;
      case 'RSET':
        resetEnvelope();
        reply('250 2.0.0 reset');
        return;
      case 'NOOP':
        reply('250 2.0.0 ok');
        return;
      case 'QUIT':
        reply('221 2.0.0 bye');
        socket.end();
        return;
      default:
        reply('502 5.5.2 command not implemented');
    }
  };

  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let boundary = buffer.indexOf('\r\n');
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      handleLine(line);
      boundary = buffer.indexOf('\r\n');
    }
  });
  socket.on('error', () => undefined);
  reply('220 localhost ESMTP Emorapy CI sink');
}

const smtpServer = tls.createServer(
  {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    minVersion: 'TLSv1.2',
  },
  createSession
);

const apiServer = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ready', messageCount: messages.length }));
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/messages/latest') {
    const recipient = requestUrl.searchParams.get('to')?.trim().toLowerCase();
    const message = [...messages]
      .reverse()
      .find((candidate) => !recipient || candidate.recipients.includes(recipient));
    if (!message) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'message_not_found' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(message));
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

smtpServer.listen(smtpPort, '127.0.0.1', () => {
  console.log(`[ci-smtps-sink] SMTP ready on 127.0.0.1:${smtpPort}`);
});
apiServer.listen(apiPort, '127.0.0.1', () => {
  console.log(`[ci-smtps-sink] API ready on 127.0.0.1:${apiPort}`);
});

function shutdown() {
  smtpServer.close();
  apiServer.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
