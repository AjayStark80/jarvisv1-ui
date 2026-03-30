/**
 * Device identity + signing for OpenClaw gateway WS handshake
 * Uses @noble/ed25519 matching the control-ui bundle
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// noble/ed25519 needs sha512 in Node
ed.etc.sha512Sync = (...msgs) => sha512(ed.etc.concatBytes(...msgs));

const IDENTITY_PATH = join(homedir(), '.openclaw', 'jarvisv1-device.json');

function hexToBytes(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

// Control-UI uses base64url for publicKey/privateKey storage (Zt function)
function bytesToBase64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(Buffer.from(padded, 'base64'));
}

export async function getOrCreateDeviceIdentity() {
  if (existsSync(IDENTITY_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(IDENTITY_PATH, 'utf8'));
      if (stored.version === 1 && stored.deviceId && stored.publicKey && stored.privateKey) {
        return stored;
      }
    } catch {}
  }

  // Generate new keypair
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

  // deviceId = SHA-256 hex of the public key bytes (matches control-ui: $t(SHA-256(pointBytes)))
  const webHash = await crypto.subtle.digest('SHA-256', publicKeyBytes.buffer);
  const deviceId = Array.from(new Uint8Array(webHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  const identity = {
    version: 1,
    deviceId,
    publicKey: bytesToBase64url(publicKeyBytes),
    privateKey: bytesToBase64url(privateKeyBytes),
  };

  mkdirSync(dirname(IDENTITY_PATH), { recursive: true });
  writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
  console.log('[jarvisv1] Generated new device identity:', deviceId.slice(0, 16) + '...');
  return identity;
}

export async function signConnectChallenge({ identity, clientId, clientMode, role, scopes, token, nonce }) {
  const signedAtMs = Date.now();

  // v2 payload format from control-ui source:
  // `v2|deviceId|clientId|clientMode|role|scopes.join(',')|signedAtMs|token|nonce`
  const payload = [
    'v2',
    identity.deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(','),
    String(signedAtMs),
    token ?? '',
    nonce,
  ].join('|');

  const privateKeyBytes = base64urlToBytes(identity.privateKey);
  const msgBytes = new TextEncoder().encode(payload);
  const sigBytes = await ed.signAsync(msgBytes, privateKeyBytes);

  return {
    id: identity.deviceId,                  // field name is 'id' in connect params
    publicKey: identity.publicKey,          // base64url
    signature: bytesToBase64url(sigBytes),  // base64url
    signedAt: signedAtMs,
    nonce,
  };
}
