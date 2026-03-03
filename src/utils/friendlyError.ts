/**
 * Convert raw server/SDK error messages into user-friendly text.
 * Returns { title, detail } for the toast.
 */
export default function friendlyError(raw: string): { title: string; detail: string } {
  const s = raw.replace(/\\n/g, ' ').trim()

  // --- Balance errors ---
  const balMatch = s.match(/Insufficient balance[:\s]*need\s+(\d+)\s+but\s+have\s+(\d+)/i)
  if (balMatch) {
    const need = balMatch[1]
    const have = balMatch[2]
    return {
      title: 'Insufficient Balance',
      detail: `Your wallet has ${have} DEM but this transaction requires ${need} DEM.`
    }
  }

  // L2PS balance with fee breakdown: "need X (Y + Z fee) but have W"
  const balFeeMatch = s.match(/Insufficient balance[:\s]*need\s+(\d+)\s+\((\d+)\s*\+\s*(\d+)\s*fee\)\s+but\s+have\s+(\d+)/i)
  if (balFeeMatch) {
    const [, total, amount, fee, have] = balFeeMatch
    return {
      title: 'Insufficient Balance',
      detail: `Need ${total} DEM (${amount} + ${fee} fee) but your wallet only has ${have} DEM.`
    }
  }

  // --- Signature errors ---
  if (/SIGNATURE\s*ERROR/i.test(s) || /signature.*verif/i.test(s)) {
    return {
      title: 'Signature Error',
      detail: 'Transaction signature could not be verified. Please reconnect your wallet and try again.'
    }
  }

  // --- Missing fields ---
  if (/No\s+.?from.?\s+field/i.test(s)) {
    return { title: 'Invalid Transaction', detail: 'Sender address is missing. Please reconnect your wallet.' }
  }

  // --- Duplicate transaction ---
  if (/already\s+processed|duplicate/i.test(s)) {
    return { title: 'Duplicate Transaction', detail: 'This transaction has already been processed.' }
  }

  // --- L2PS network not found ---
  if (/L2PS.*not found|missing config/i.test(s)) {
    return { title: 'L2PS Network Error', detail: 'The L2PS network is not available. Check your L2PS UID in settings.' }
  }

  // --- Decryption failure ---
  if (/[Dd]ecryption failed/i.test(s)) {
    return { title: 'Decryption Failed', detail: 'Could not decrypt the transaction. Verify your AES key and IV in settings.' }
  }

  // --- Hash mismatch ---
  if (/hash mismatch/i.test(s)) {
    return { title: 'Integrity Error', detail: 'Transaction data was corrupted in transit. Please try again.' }
  }

  // --- Connection / network ---
  if (/ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(s)) {
    return { title: 'Connection Error', detail: 'Could not reach the node. Check your connection and node URL.' }
  }

  // --- Generic fallback: strip server prefixes for readability ---
  const cleaned = s
    .replace(/^\[Confirm\]\s*Transaction\s*is\s*not\s*valid:\s*/i, '')
    .replace(/\[(?:Native\s+)?Tx\s+Validation\]\s*/gi, '')
    .replace(/\[[\w\s]+ERROR\]\s*/gi, '')
    .trim()

  return { title: 'Transaction Failed', detail: cleaned || 'An unknown error occurred.' }
}
