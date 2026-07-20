#!/usr/bin/env node
/* İçerik şifreleyici — kişisel içeriği repoya girmeden önce AES-256-GCM ile mühürler.
   Kullanım: node scripts/encrypt.mjs <content.json> <parola> > js/content.enc.js
   content.json repoya ASLA commit'lenmez; sadece şifreli çıktı commit'lenir. */

import { webcrypto as crypto } from 'crypto';
import { readFileSync } from 'fs';

const [file, pass] = process.argv.slice(2);
if (!file || !pass) {
  console.error('Kullanım: node scripts/encrypt.mjs <content.json> <parola>');
  process.exit(1);
}

const ITERATIONS = 300000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);

const plain = enc.encode(JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))));
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));

const b64 = u8 => Buffer.from(u8).toString('base64');
process.stdout.write(
`/* Mühürlü içerik — AES-256-GCM + PBKDF2(${ITERATIONS}). Düz metni repoya koyma. */
const CONTENT_ENC = {
  iterations: ${ITERATIONS},
  salt: '${b64(salt)}',
  iv: '${b64(iv)}',
  data: '${b64(cipher)}',
};
`);
