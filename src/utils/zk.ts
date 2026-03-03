import { ethers } from 'ethers'

/**
 * Hash a commitment from a wallet address and secret.
 * Commitment = H("wallet:" + address + ":" + secret)
 */
export function hashCommitment(address: string, secret: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`wallet:${address}:${secret}`))
}

/**
 * Hash a nullifier from a wallet address, context, and secret.
 * Nullifier = H("wallet:" + address + ":" + context + ":" + secret)
 */
export function hashNullifier(address: string, context: string, secret: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`wallet:${address}:${context}:${secret}`))
}

/**
 * Simulate a ZK proof structure matching the snarkjs Groth16 format.
 * This is a placeholder for real proof generation.
 */
export function simulateProof(
  nullifier: string,
  merkleRoot: string,
  context: string
): { proof: GrothProof; publicSignals: string[] } {
  return {
    proof: {
      pi_a: [nullifier.slice(0, 20), nullifier.slice(20, 40), '1'],
      pi_b: [
        [merkleRoot.slice(0, 20), merkleRoot.slice(20, 40)],
        [context.slice(0, 10), context.slice(10, 20)],
        ['1', '0'],
      ],
      pi_c: [nullifier.slice(5, 25), merkleRoot.slice(5, 25), '1'],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: [
      nullifier,
      merkleRoot,
      ethers.keccak256(ethers.toUtf8Bytes(context)),
    ],
  }
}

export interface GrothProof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
  protocol: string
  curve: string
}

/**
 * Fetch the current merkle root and leaf count from the ZK endpoint.
 */
export async function fetchMerkleRoot(
  baseUrl = '/zk'
): Promise<{ leafCount: number; root?: string } | null> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)

    const res = await fetch(`${baseUrl}/merkle-root`, {
      signal: controller.signal,
    })
    if (!res.ok) return null

    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return { leafCount: data.leafCount ?? 0, root: data.root }
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Submit a commitment hash to the ZK node.
 */
export async function submitCommitment(
  commitment: string,
  baseUrl = '/zk'
): Promise<{ success: boolean; message?: string }> {
  try {
    const payload = {
      method: 'identity_commitment',
      params: [
        {
          commitment_hash: commitment,
          provider: 'wallet',
          timestamp: Date.now(),
        },
      ],
    }

    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }

    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return { success: true, message: data.message }
    } catch {
      return { success: false, message: text || `HTTP ${res.status}` }
    }
  } catch (e: unknown) {
    const err = e as Error
    return { success: false, message: err.message || 'Network error' }
  }
}

/**
 * Submit a ZK proof and public signals for verification.
 */
export async function submitProof(
  proof: GrothProof,
  publicSignals: string[],
  baseUrl = '/zk'
): Promise<{ success: boolean; message?: string }> {
  try {
    const payload = {
      method: 'verifyProof',
      params: [
        {
          proof,
          publicSignals,
          provider: 'wallet',
        },
      ],
    }

    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) return { success: false, message: `HTTP ${res.status}` }

    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return { success: true, message: data.message }
    } catch {
      return { success: false, message: text || `HTTP ${res.status}` }
    }
  } catch (e: unknown) {
    const err = e as Error
    return { success: false, message: err.message || 'Network error' }
  }
}
