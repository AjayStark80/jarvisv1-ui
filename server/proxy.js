/**
 * JarvisV1 Gateway Proxy
 * Bridges the React UI to the OpenClaw WebSocket gateway
 * Uses proper Ed25519 device identity + signing
 */

import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateDeviceIdentity, signConnectChallenge } from './deviceIdentity.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const GATEWAY_URL = 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'a4f1d9b4bc165066351de5c382db848f21a8968bff23fa69';
const CLIENT_ID = 'gateway-client';
const CLIENT_MODE = 'cli';
const ROLE = 'operator';
const SCOPES = ['operator.read', 'operator.write'];

let deviceIdentity = null;

async function start() {
  deviceIdentity = await getOrCreateDeviceIdentity();
  console.log('[jarvisv1] Device identity ready:', deviceIdentity.deviceId.slice(0, 16) + '...');

  app.listen(PORT, () => {
    console.log(`JarvisV1 proxy running on http://localhost:${PORT}`);
    console.log(`Gateway: ${GATEWAY_URL}`);
  });
}

app.get('/health', (req, res) => {
  res.json({ ok: true, gateway: GATEWAY_URL, deviceReady: !!deviceIdentity });
});

app.post('/chat', async (req, res) => {
  const { message, sessionKey } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  if (!deviceIdentity) return res.status(503).json({ error: 'Device identity not ready' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let ws;
  const reqId = uuidv4();
  const chatReqId = uuidv4();
  const idempotencyKey = uuidv4();
  const activeSessionKey = sessionKey || `jarvisv1:${uuidv4()}`;
  let deviceToken = null;

  try {
    ws = new WebSocket(GATEWAY_URL);

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // Challenge — sign and connect
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        const nonce = msg.payload?.nonce;
        try {
          const device = await signConnectChallenge({
            identity: deviceIdentity,
            clientId: CLIENT_ID,
            clientMode: CLIENT_MODE,
            role: ROLE,
            scopes: SCOPES,
            token: GATEWAY_TOKEN,
            nonce,
          });

          ws.send(JSON.stringify({
            type: 'req',
            id: reqId,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: { id: CLIENT_ID, version: '1.0.0', platform: 'macos', mode: CLIENT_MODE },
              role: ROLE,
              scopes: SCOPES,
              caps: [],
              commands: [],
              permissions: {},
              auth: { token: GATEWAY_TOKEN },
              locale: 'en-US',
              userAgent: 'jarvisv1-proxy/1.0.0',
              device,
            }
          }));
        } catch (err) {
          send('error', { message: `Signing failed: ${err.message}` });
          ws.close();
          res.end();
        }
      }

      // Connected
      if (msg.type === 'res' && msg.id === reqId) {
        if (msg.ok) {
          // Save device token for future reconnects
          if (msg.payload?.auth?.deviceToken) {
            deviceToken = msg.payload.auth.deviceToken;
          }

          // Subscribe to session events first
          ws.send(JSON.stringify({
            type: 'req',
            id: uuidv4(),
            method: 'sessions.messages.subscribe',
            params: { sessionKey: activeSessionKey }
          }));

          // Send the chat message
          ws.send(JSON.stringify({
            type: 'req',
            id: chatReqId,
            method: 'chat.send',
            params: {
              sessionKey: activeSessionKey,
              message,
              deliver: false,
              idempotencyKey,
              attachments: [],
            }
          }));

          send('session', { sessionKey: activeSessionKey });
        } else {
          send('error', { message: msg.error?.message || 'Gateway connect failed' });
          ws.close();
          res.end();
        }
      }

      // Chat streaming via session.message events
      if (msg.type === 'event' && msg.event === 'session.message') {
        const payload = msg.payload;
        if (payload?.sessionKey !== activeSessionKey) return;

        const role = payload?.message?.role;
        const content = payload?.message?.content;

        if (role === 'assistant' && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              send('token', { text: block.text });
            }
          }
        }
      }

      // Chat done via agent event
      if (msg.type === 'event' && msg.event === 'agent') {
        const payload = msg.payload;
        if (payload?.sessionKey !== activeSessionKey) return;
        if (payload?.type === 'done' || payload?.done) {
          send('done', { sessionKey: activeSessionKey });
          ws.close();
          res.end();
        }
      }

      // chat.send response (just log errors)
      if (msg.type === 'res' && msg.id === chatReqId && !msg.ok) {
        send('error', { message: msg.error?.message || 'chat.send failed' });
        ws.close();
        res.end();
      }
    });

    ws.on('error', (err) => {
      send('error', { message: `Gateway error: ${err.message}` });
      if (!res.writableEnded) res.end();
    });

    ws.on('close', () => {
      if (!res.writableEnded) res.end();
    });

    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        send('error', { message: 'Gateway timeout' });
        ws.close();
        if (!res.writableEnded) res.end();
      }
    }, 60000);

  } catch (err) {
    send('error', { message: err.message });
    if (!res.writableEnded) res.end();
  }

  req.on('close', () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  });
});

const PORT = 3001;
start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
