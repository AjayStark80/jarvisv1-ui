const PROXY_URL = 'http://localhost:3001';

export async function sendMessage({ message, sessionKey, onToken, onDone, onError }) {
  const res = await fetch(`${PROXY_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionKey }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    onError?.(err.error || 'Request failed');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentSessionKey = sessionKey;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === 'session') currentSessionKey = data.sessionKey;
          if (currentEvent === 'token') onToken?.(data.text);
          if (currentEvent === 'done') onDone?.(currentSessionKey);
          if (currentEvent === 'error') onError?.(data.message);
        } catch {}
      }
    }
  }
}

export async function checkHealth() {
  try {
    const res = await fetch(`${PROXY_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
