# L2PS Wallet POC Application

A React + Vite + TypeScript application for demonstrating L2PS (Layer 2 Privacy Subnets) capabilities. This POC showcases private transaction flows, authenticated history access, and the rollup mechanism.

## 🚀 Quick Start

```bash
cd docs/l2ps-poc
npm install
npm run dev
# Open http://localhost:5173
```

**Prerequisites**: Node.js 18+, running Demos node with L2PS configured.

---

## 📋 Features Overview

| Feature | Description |
|---------|-------------|
| **Wallet Connection** | BIP39 mnemonic → Ed25519 keypair |
| **Dual Transaction Modes** | L1 (public) and L2PS (private) |
| **Client-Side Encryption** | AES-256 encryption in browser |
| **Authenticated History** | Signature-verified L2PS history access |
| **Interactive Learn Tab** | Educational demos and explanations |
| **Filter Tabs** | View All, L2PS only, or L1 only transactions |

---

## 🔐 1. Keys Handling & Environment

L2PS transactions are **encrypted client-side** before leaving the wallet. The POC requires `AES Key` and `IV` that match the node configuration.

### Configuration Options

**Option A: Environment Variables (Recommended)**

Create `.env` in `docs/l2ps-poc/`:
```bash
VITE_NODE_URL="http://127.0.0.1:53550"
VITE_L2PS_UID="testnet_l2ps_001"
VITE_L2PS_AES_KEY="b9346ff30a8202cd46caa7b4b0142bfc727c99cc0f8667580af945b493038055"
VITE_L2PS_IV="f5405674114eb2adea5774d36b701a6d"
```

**Option B: UI Settings**

Click "Advanced Settings" in the Send tab to configure keys at runtime.

### 🔑 Generating Keys

```bash
# Generate 256-bit AES Key (64 hex characters)
openssl rand -hex 32

# Generate 128-bit IV (32 hex characters)  
openssl rand -hex 16
```

### ⚠️ Critical: Matching Keys

**Client and Node keys MUST match!**

| Location | Files |
|----------|-------|
| **Client (POC)** | `.env` or UI settings |
| **Node** | `data/l2ps/<uid>/private_key.txt` and `iv.txt` |

If keys don't match, transactions will fail decryption on the node.

---

## 🔌 2. Wallet Connection

1. **Generate New**: Creates a fresh BIP39 24-word mnemonic
2. **Connect Wallet**:
   - Derives Ed25519 keypair from mnemonic
   - Connects to Demos Node via WebSocket
   - Fetches initial balance

**Note**: In production, use secure mnemonic storage and hardware wallet integration.

---

## 💸 3. Sending Transactions

### L1 Mode (Public) 📤

Standard blockchain transaction visible to everyone:

```
Alice → Bob: 5 DEM
     ↓
[Everyone sees: "Alice → Bob: 5 DEM"]
```

### L2PS Mode (Private) 🔒

Encrypted transaction with rollup:

```
Alice → Bob: 5 DEM
     ↓
[Browser encrypts with AES-256]
     ↓
[Network sees: "Encrypted blob → L2PS Network"]
     ↓
[Only L2PS nodes can decrypt]
```

### Transaction Fees

| Type | Fee | Destination |
|------|-----|-------------|
| L1 Transaction | 0 DEM | N/A |
| L2PS Transaction | **1 DEM** | Burned (removed from circulation) |

The 1 DEM fee is automatically deducted from sender's balance in addition to the transfer amount.

---

## 📦 4. Transaction Lifecycle

L2PS transactions go through multiple statuses:

```
[1] Submit      →  ⚡ Executed (local validation passed)
      ↓
[2] Wait ~10s   →  📦 Batched (included in L1 batch)
      ↓
[3] Consensus   →  ✓ Confirmed (L1 block confirmed)
```

### Batch Aggregation

Every ~10 seconds, the node:
1. Collects up to 10 pending L2PS transactions
2. Aggregates their state changes (GCR edits)
3. Generates ZK proof of validity
4. Submits single batch transaction to L1

---

## 📜 5. Transaction History

### Filter Tabs

The History tab provides three views:

| Tab | Shows | Count |
|-----|-------|-------|
| **All** | Combined and deduplicated | X |
| **🔒 L2PS** | Only L2PS transactions | Y |
| **📤 L1** | Only L1 transactions | Z |

### Access Control

| Type | Endpoint | Access |
|------|----------|--------|
| L1 History | `getTransactionHistory` | **Public** (anyone) |
| L2PS History | `getL2PSAccountTransactions` | **Authenticated** (owner only) |

**L2PS Authentication Flow:**
1. Wallet signs: `getL2PSHistory:{address}:{timestamp}`
2. Node verifies signature matches address
3. If valid → returns private history
4. If invalid → 403 Access Denied

---

## 🎓 6. Learn Tab Features

The Learn tab provides interactive demonstrations:

### Privacy Demo
- **Fetch L2PS History** button opens choice modal
- **Skip Signing** → Shows 403 ACCESS DENIED
- **Sign Request** → Shows successful authenticated access

### Educational Sections
- What is L2PS?
- Transaction Lifecycle visualization
- Fee explanation
- Key takeaways

---

## 💬 7. L2PS Messaging (Test Tab)

The **💬 Messaging** tab exercises the node's **L2PS instant-messaging server**
(node feature `l2ps-messaging`, default `ws://<node>:3006`). It lets you register
two wallets and exchange messages — no code required.

> A **peer is a wallet** (an Ed25519 key), not a node. Two peers = two mnemonics,
> both connected to the **same** messaging server. Open the POC in two browser
> sessions to run two peers at once.

Messaging is **free** — no DEM, no balance required (fees are hard-zeroed in the
server). The only limits are technical: message ≤256 KB, ciphertext ≤128 KB, and
the offline queue holds 200 messages per sender.

### Run it locally

**1. Start a node with messaging enabled** (`node` repo):

```bash
# enable the messaging server + a matching L2PS subnet
./scripts/l2ps-create-subnet.sh testnet_l2ps_001      # once — creates data/l2ps/<uid>/
L2PS_MESSAGING_ENABLED=true L2PS_MESSAGING_PORT=3006 docker compose up -d
# look for: [L2PS-IM] Messaging server started on port 3006
```

See the node repo `src/features/l2ps-messaging/L2PS_MESSAGING_QUICKSTART.md` for
the full protocol.

**2. Point the POC at it** — `.env`:

```bash
VITE_NODE_URL="http://localhost:53550"
VITE_MSG_WS_URL="ws://localhost:3006"   # the messaging WS (override the :3006 default)
VITE_L2PS_UID="testnet_l2ps_001"        # must match the subnet you created
```

**3. Test with two peers:**

1. Open the POC in **two** browser sessions (e.g. normal + incognito).
2. In each: **Login** → Generate a (different) mnemonic → Connect.
3. In each: **💬 Messaging** → **Connect & Register** (status turns green `registered`).
4. Copy one peer's key from the `You: 0x…` line into the other's **recipient** field
   (or click the peer chip), type a message, **Send**.
5. *(Offline queue)* Disconnect peer B, send from A, then re-register B — the
   message arrives `from queue`.

### Connect at the code level

The whole flow lives in [`src/hooks/useMessaging.ts`](src/hooks/useMessaging.ts) —
a minimal WebSocket client over the wire protocol (no dependency on the newer
SDK's `L2PSMessagingPeer`, so the pinned `demosdk@2.8.16` stays):

```ts
// register: sign the proof string with the wallet's ed25519 key
const timestamp = Date.now()
const proof = toHex(
  (await demos.crypto.sign(
    'ed25519',
    new TextEncoder().encode(`register:${publicKey}:${timestamp}`),
  )).signature,
)
ws.send(JSON.stringify({
  type: 'register',
  payload: { publicKey, l2psUid, proof },
  timestamp,
}))
// -> { type: 'registered', payload: { onlinePeers: [...] } }

// send: ciphertext + a non-empty nonce are required
ws.send(JSON.stringify({
  type: 'send',
  payload: {
    to: recipientPublicKey,
    encrypted: { ciphertext, nonce, ephemeralKey },
    messageHash,
  },
  timestamp: Date.now(),
}))
// recipient receives: { type: 'message', payload: { from, encrypted, offline } }
```

> **Transport test only.** The tab base64-wraps plaintext into `ciphertext` — it is
> **not** end-to-end encrypted. Real x25519+AES-GCM lives in the SDK's
> `L2PSMessagingPeer`; this validates the server's register/send/receive/offline path.
> Wire it into a production app via the SDK, not this hook.

---

## 🏗️ Architecture Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Client Encryption** | ✅ Ready | `utils/l2ps.ts` handles AES-256 |
| **L2PS Decryption** | ✅ Ready | `handleL2PS.ts` decrypts transactions |
| **Transaction Fee** | ✅ Ready | 1 DEM burned per L2PS transaction |
| **GCR Edits** | ✅ Ready | State changes calculated and stored |
| **Mempool** | ✅ Ready | Separate `l2ps_mempool` table |
| **Batch Aggregator** | ✅ Ready | Runs every 10s, max 10 tx/batch |
| **ZK Proofs** | ✅ Ready | PLONK proofs for batch validity |
| **Consensus** | ✅ Ready | GCR edits applied per L1 block |
| **Mempool Sync** | ✅ Ready | P2P sync between nodes |
| **DTR Routing** | ✅ Ready | Hash relay to validators |
| **History API** | ✅ Ready | Authenticated endpoint |
| **Filter Tabs** | ✅ Ready | All/L2PS/L1 filtering |

---

## 📁 File Structure

```
l2ps-poc/
├── src/
│   ├── App.tsx              # Main application logic
│   ├── utils/
│   │   └── l2ps.ts          # Encryption & transaction building
│   └── index.css            # Styling with animations
├── .env                     # Configuration (create from example)
├── index.html               # Entry point
├── vite.config.ts           # Vite configuration
└── package.json             # Dependencies
```

---

## 🔧 Troubleshooting

### "Failed to fetch balance"
- Ensure node is running at configured URL
- Check browser console for WebSocket errors

### "Encryption failed"
- Verify AES Key is 64 hex characters
- Verify IV is 32 hex characters

### "Access denied" for history
- This is expected for other users' addresses
- For your own address, signature verification should pass

### "Insufficient balance"
- L2PS requires amount + 1 DEM fee
- Fund wallet using genesis configuration

---

## 🔗 Related Documentation

- [L2PS Overview](https://docs.kynesys.xyz/backend/l2ps-subnet-framework/overview) - What is L2PS and how it works
- [L2PS Quickstart](https://docs.kynesys.xyz/backend/l2ps-subnet-framework/quickstart) - Get started with L2PS
- [How L2PS Transactions Are Handled](https://docs.kynesys.xyz/backend/l2ps-subnet-framework/how-are-l2ps-transactions-handled) - Transaction lifecycle deep dive
