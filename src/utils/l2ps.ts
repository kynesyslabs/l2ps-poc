
import { Demos } from "@kynesyslabs/demosdk/websdk"
import { L2PS, buildSettledL2PSTransfer } from "@kynesyslabs/demosdk/l2ps"
import type { L2PSEncryptedPayload } from "@kynesyslabs/demosdk/l2ps"
import type { Transaction } from "@kynesyslabs/demosdk/types"
import forge from "node-forge"

export type { L2PSEncryptedPayload }

export function normalizeHex(address: string, label: string = "Address"): string {
    if (!address) {
        throw new Error(`${label} is required`)
    }

    const cleaned = address.trim()
    const hex = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`

    if (hex.length !== 66) {
        throw new Error(`${label} invalid: Expected 64 hex characters (32 bytes) with 0x prefix, but got ${hex.length - 2} characters.`)
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(`${label} contains invalid hex characters.`)
    }

    return hex.toLowerCase()
}

export function sanitizeHexValue(value: string, label: string): string {
    if (!value || typeof value !== "string") {
        throw new Error(`Missing ${label}`)
    }

    const cleaned = value.trim().replace(/^0x/, "").replaceAll(/\s+/g, "")

    if (cleaned.length === 0) {
        throw new Error(`${label} is empty`)
    }

    if (cleaned.length % 2 !== 0) {
        throw new Error(`${label} has invalid length (must be even number of hex chars)`)
    }

    if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
        throw new Error(`${label} contains non-hex characters`)
    }

    return cleaned.toLowerCase()
}

export interface PrivateTransfer {
    /** Signed inner transfer: what the subnet members decrypt and settle. */
    inner: Transaction
    /** Signed `l2psEncryptedTx` envelope that is submitted to the member. */
    outer: Transaction
    /** OS fee the settlement charges the sender. */
    fee: bigint
    /** The ciphertext the network sees, for the privacy preview. */
    payload: L2PSEncryptedPayload
}

/**
 * Builds an L2PS settled transfer the way l2psSettlement networks (rc.13+)
 * expect it: the SDK signs the inner native send with its settlement
 * commitment, the subnet key encrypts it, and the sender signs the encrypted
 * envelope with the same nonce the commitment binds.
 */
export async function buildPrivateTransfer(
    demos: Demos,
    l2ps: L2PS,
    options: { to: string; amountOs: bigint; l2psUid: string; nonce: number },
): Promise<PrivateTransfer> {
    const inner = await buildSettledL2PSTransfer(demos, {
        to: normalizeHex(options.to, "Recipient address"),
        amount: options.amountOs,
        l2psUid: options.l2psUid,
        // An explicit nonce keeps the SDK's auto-nonce reservation out of it,
        // so a preview build never shifts the nonce of the next real send.
        nonce: options.nonce,
    })
    const encrypted = await l2ps.encryptTx(inner)
    const outer = await demos.tx.prepare()
    outer.content.type = "l2psEncryptedTx" as Transaction["content"]["type"]
    outer.content.to = encrypted.content.to
    outer.content.amount = 0
    outer.content.data = encrypted.content.data
    outer.content.nonce = inner.content.nonce
    outer.content.timestamp = Date.now()
    const signed = await demos.sign(outer)

    const innerData = inner.content.data as unknown as [string, { settlement?: { fee?: string } }]
    const fee = BigInt(innerData?.[1]?.settlement?.fee ?? "0")
    const payload = (encrypted.content.data as unknown as [string, L2PSEncryptedPayload])[1]
    return { inner, outer: signed, fee, payload }
}

/** Sends a signed transaction through confirm + broadcast and throws the node's refusal. */
export async function submitTransaction(demos: Demos, signed: Transaction): Promise<void> {
    const validity = await demos.confirm(signed)
    const data = (validity?.response as unknown as { data?: { valid?: boolean; message?: string } })?.data
    if (!data?.valid) {
        throw new Error(String(data?.message ?? "Transaction rejected by node").trim())
    }
    const sent = await demos.broadcast(validity) as unknown as Record<string, unknown>
    if (sent?.result !== 200) {
        const inner = sent?.response as Record<string, unknown> | undefined
        const extra = sent?.extra || inner?.extra || sent?.response
        throw new Error((typeof extra === "string" ? extra : JSON.stringify(extra)) || "Broadcast failed")
    }
}

export async function createL2PSInstance(keyHex: string, ivHex: string, uid: string, nodeUrl: string): Promise<L2PS> {
    const hexKey = sanitizeHexValue(keyHex, "L2PS key")
    const hexIv = sanitizeHexValue(ivHex, "L2PS IV")
    if (hexKey.length !== 64) throw new Error("L2PS key must be 64 hex characters (AES-256)")
    if (hexIv.length !== 32) throw new Error("L2PS IV must be 32 hex characters")
    const keyBytes = forge.util.hexToBytes(hexKey)
    const ivBytes = forge.util.hexToBytes(hexIv)

    const l2ps = await L2PS.create(keyBytes, ivBytes)
    l2ps.setConfig({ uid: uid, config: { created_at_block: 0, known_rpcs: [nodeUrl] } })
    return l2ps
}
