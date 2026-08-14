# Training USDT — TRC-20 (TRON)

Local-only TRON simulation, mirroring `backend/ethereum`. No real TRON
network, no real TRX, no real accounts.

## Requirements

- Docker Desktop running
- Node.js 18+

## First-time setup

```
npm install
```

## Running it

**1. Start a local private TRON node (Docker):**
```
docker run -d --name tron-training-node -p 9090:9090 tronbox/tre
```
Wait ~30-40s for it to finish starting, then check it's ready:
```
curl http://127.0.0.1:9090/wallet/getnowblock
```

**2. Grab this run's test accounts:**
```
docker logs tron-training-node
```
Look for the "Available Accounts" / "Private Keys" section. Unlike Hardhat,
**this image generates a fresh random set of accounts every time the
container starts** — there's no fixed deterministic address here. Copy
Account #0's private key into `tronbox.js` → `networks.development.privateKey`.

**3. Compile and deploy:**
```
npx tronbox compile
npx tronbox migrate --network development
```
This prints the deployed contract's address (both base58 `T...` form and hex
form). Save the base58 address — the frontend will need it.

**4. Run the test suite (optional sanity check):**
```
npx tronbox test --network development
```

## Stopping / resetting

```
docker rm -f tron-training-node
```
This wipes all simulated chain state (balances, deployed contracts). Start a
new container and redeploy to reset everything, exactly like restarting a
Hardhat node.

## Contract

`contracts/TrainingUSDT.sol` — a self-contained TRC-20 implementation (no
external imports, for straightforward TVM compilation): 6 decimals,
100,000,000 fixed supply minted to the deployer, standard
`transfer`/`approve`/`transferFrom`, plus a read-only `simulatedUsdPrice()`
helper (constant `1_000_000` = $1.00 at 6 decimals) used only by this
project's own training UI.
