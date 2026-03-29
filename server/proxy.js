/**
 * JarvisV1 Gateway Proxy
 * Bridges the React UI to the OpenClaw WebSocket gateway
 */

import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const GATEWAY_URL = 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'a4f1d9b4bc165066351de5c382db848f21a8968bff23fa69';

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, gateway: GATEWAY_URL });
});

// Chat endpoint — streams response via SSE
app.post('/chat', async (req, res) => {
  const { message, sessionKey } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let ws;
  let connected = false;
  let challenged = false;
  const reqId = uuidv4();
  const chatReqId = uuidv4();
  const activeSessionKey = sessionKey || `jarvisv1:${uuidv4()}`;

  try {
    ws = new WebSocket(GATEWAY_URL);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // Challenge — respond with connect
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        challenged = true;
        ws.send(JSON.stringify({
          type: 'req',
          id: reqId,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: 'jarvisv1-ui', version: '1.0.0', platform: 'web', mode: 'operator' },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token: GATEWAY_TOKEN },
            locale: 'en-US',
            userAgent: 'jarvisv1-ui/1.0.0',
          }
        }));
      }

      // Connected — send chat message
      if (msg.type === 'res' && msg.id === reqId && msg.ok) {
        connected = true;
        ws.send(JSON.stringify({
          type: 'req',
          id: chatReqId,
          method: 'chat.send',
          params: {
            sessionKey: activeSessionKey,
            message,
            stream: true,
          }
        }));
        send('session', { sessionKey: activeSessionKey });
      }

      // Chat streaming events
      if (msg.type === 'event') {
        if (msg.event === 'chat.token' && msg.payload?.sessionKey === activeSessionKey) {
          send('token', { text: msg.payload.token });
        }
        if (msg.event === 'chat.done' && msg.payload?.sessionKey === activeSessionKey) {
          send('done', { sessionKey: activeSessionKey });
          ws.close();
          res.end();
        }
        if (msg.event === 'chat.error') {
          send('error', { message: msg.payload?.message || 'Unknown error' });
          ws.close();
          res.end();
        }
      }

      // Connection error
      if (msg.type === 'res' && msg.id === reqId && !msg.ok) {
        send('error', { message: msg.error?.message || 'Gateway auth failed' });
        ws.close();
        res.end();
      }
    });

    ws.on('error', (err) => {
      send('error', { message: `Gateway connection failed: ${err.message}` });
      res.end();
    });

    ws.on('close', () => {
      if (!res.writableEnded) res.end();
    });

    // Timeout
    setTimeout(() => {
      if (!connected && ws.readyState !== WebSocket.CLOSED) {
        send('error', { message: 'Gateway connection timeout' });
        ws.close();
        res.end();
      }
    }, 10000);

  } catch (err) {
    send('error', { message: err.message });
    res.end();
  }

  req.on('close', () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`JarvisV1 proxy running on http://localhost:${PORT}`);
  console.log(`Gateway: ${GATEWAY_URL}`);
});
