import { x25519, edwardsToMontgomeryPub, edwardsToMontgomeryPriv } from '@noble/curves/ed25519'

// Real end-to-end encryption for the L2PS messaging POC.
//
// The messaging server only relays an opaque { ciphertext, nonce, ephemeralKey }
// envelope (node: src/features/l2ps-messaging/types.ts → SerializedEncryptedMessage)
// and never sees plaintext. We key the envelope off the peers' *identity* ed25519
// keys — the same hex the server already uses for `from`/`to` — so there is no
// separate key exchange: a recipient's public key IS their encryption key.
//
// Per message we generate an ephemeral X25519 keypair, ECDH it against the
// recipient's identity key (ed25519 → X25519), derive an AES-256-GCM key with
// HKDF-SHA256, and encrypt. This is a libsodium-style sealed box: it gives real
// per-recipient confidentiality, but no forward secrecy against the recipient's
// long-term key (compromise of a recipient key exposes their past messages) —
// a double-ratchet is the follow-up, out of scope for the POC.

export interface EncryptedEnvelope {
  ciphertext: string // base64
  nonce: string // base64 (AES-GCM IV)
  ephemeralKey: string // hex (X25519 ephemeral public key)
}

const HKDF_INFO = new TextEncoder().encode('l2ps-msg:v1')

// WebCrypto's DOM types demand an ArrayBuffer-backed view; our byte arrays
// always are, but TS 5.7's `Uint8Array<ArrayBufferLike>` generic needs the nudge.
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) throw new Error('invalid hex')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}
function toBase64(b: Uint8Array): string {
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s)
}
function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function aesKeyFromShared(shared: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', buf(shared), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// A forge ed25519 private key is 64 bytes (seed‖publicKey); the X25519 mapping
// needs only the 32-byte seed.
export function ed25519Seed(privateKey: Uint8Array): Uint8Array {
  return privateKey.length >= 32 ? privateKey.slice(0, 32) : privateKey
}

// Encrypt `plaintext` for the peer identified by their ed25519 public key (hex).
export async function sealTo(
  recipientEd25519Hex: string,
  plaintext: string,
): Promise<EncryptedEnvelope> {
  const recipientX = edwardsToMontgomeryPub(hexToBytes(recipientEd25519Hex))
  const ephSeed = crypto.getRandomValues(new Uint8Array(32))
  const ephXpriv = edwardsToMontgomeryPriv(ephSeed)
  const ephXpub = x25519.getPublicKey(ephXpriv)
  const shared = x25519.getSharedSecret(ephXpriv, recipientX)
  const key = await aesKeyFromShared(shared)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buf(iv) },
      key,
      buf(new TextEncoder().encode(plaintext)),
    ),
  )
  return { ciphertext: toBase64(ct), nonce: toBase64(iv), ephemeralKey: bytesToHex(ephXpub) }
}

// Decrypt an envelope addressed to us, using our ed25519 private key (forge, 64-byte).
export async function openFrom(
  env: EncryptedEnvelope,
  myEd25519PrivateKey: Uint8Array,
): Promise<string> {
  if (!env?.ciphertext || !env?.nonce || !env?.ephemeralKey) throw new Error('incomplete envelope')
  const myX = edwardsToMontgomeryPriv(ed25519Seed(myEd25519PrivateKey))
  const shared = x25519.getSharedSecret(myX, hexToBytes(env.ephemeralKey))
  const key = await aesKeyFromShared(shared)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf(fromBase64(env.nonce)) },
    key,
    buf(fromBase64(env.ciphertext)),
  )
  return new TextDecoder().decode(pt)
}
