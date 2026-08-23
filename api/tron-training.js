
const { TronWeb } = require("tronweb");

const NILE_HOST = (process.env.TRON_NILE_HOST || "https://nile.trongrid.io").replace(/\/+$/, "");
const TOKEN_ID = process.env.TRON_TOKEN_ID || "1007344";
const TRX_DECIMALS = 6;
const TOKEN_DECIMALS = 6;

function assertNileHost() {
  if (!/^https:\/\/[a-z0-9.-]*nile[a-z0-9.-]*$/i.test(NILE_HOST)) {
    throw new Error(`TRON training is allowlisted to Nile only; TRON_NILE_HOST is "${NILE_HOST}".`);
  }
}

let treasuryPrivateKey = null;
let treasuryAddress = null;

function initTronTreasury() {
  const rawKey = (process.env.TRON_TREASURY_PRIVATE_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    const msg = "Invalid TRON_TREASURY_PRIVATE_KEY: expected exactly 64 hexadecimal characters.";
    console.error(msg);
    throw new Error(msg);
  }

  treasuryPrivateKey = rawKey;
  const tronWeb = createTronWeb();
  treasuryAddress = tronWeb.address.fromPrivateKey(treasuryPrivateKey);

  console.log(`[TRON Treasury] Derived Base58 address: ${treasuryAddress}`);

  const configuredAddress = (
    process.env.TRON_TREASURY_ADDRESS ||
    process.env.CLASSCHAIN_TRON_ADDRESS ||
    ""
  ).trim();

  if (configuredAddress) {
    const matches = treasuryAddress === configuredAddress;
    console.log(
      `[TRON Treasury] Derived address (${treasuryAddress}) ${
        matches ? "matches" : "does NOT match"
      } configured treasury address (${configuredAddress}).`
    );
  } else {
    console.log("[TRON Treasury] No configured treasury address provided in env.");
  }

  return { treasuryAddress };
}

// Perform treasury initialization on backend startup
initTronTreasury();

function getTreasuryAddress() {
  if (!treasuryAddress) {
    initTronTreasury();
  }
  return treasuryAddress;
}

function createTronWeb(privateKey) {
  assertNileHost();
  return privateKey
    ? new TronWeb({ fullHost: NILE_HOST, privateKey })
    : new TronWeb({ fullHost: NILE_HOST });
}

function createTreasurySignerTronWeb() {
  if (!treasuryPrivateKey) {
    initTronTreasury();
  }
  return createTronWeb(treasuryPrivateKey);
}

function toBaseUnits(amountStr, decimals) {
  const value = String(amountStr).trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Invalid amount. Enter a positive number (e.g. 1.5).");
  }
  const [whole, frac = ""] = value.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

function fromBaseUnits(value, decimals) {
  const v = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0");
  return `${whole}.${frac}`.replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function padHuman(amountStr, decimals) {
  const value = String(amountStr).trim();
  const [whole, frac = ""] = value.split(".");
  return `${whole || "0"}.${(frac + "0".repeat(decimals)).slice(0, decimals)}`;
}

function validateAmount(amountStr, decimals) {
  const value = String(amountStr).trim();
  if (value === "") throw new Error("Amount is required.");
  if (Number.isNaN(Number(value)) || !Number.isFinite(Number(value))) {
    throw new Error("Invalid amount.");
  }
  const units = toBaseUnits(value, decimals);
  if (units <= 0n) throw new Error("Amount must be greater than zero.");
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large.");
  return units;
}

async function getTokenInfo() {
  const res = await fetch(`${NILE_HOST}/v1/assets/${TOKEN_ID}`);
  if (!res.ok) throw new Error(`Could not read token ${TOKEN_ID} metadata (HTTP ${res.status}).`);
  const data = await res.json();
  const asset = data && data.success && Array.isArray(data.data) ? data.data[0] : null;
  if (!asset) throw new Error(`TRC-10 token ${TOKEN_ID} was not found on Nile.`);
  const precision = Number(asset.precision);
  return {
    id: String(asset.id),
    name: asset.name,
    abbr: asset.abbr,
    precision,
    totalSupply: fromBaseUnits(asset.total_supply, precision),
    totalSupplyBase: String(asset.total_supply),
    owner: TronWeb.address.fromHex(asset.owner_address),
  };
}

async function getAccountBalances(address) {
  const tronWeb = createTronWeb();
  const account = await tronWeb.trx.getAccount(address);
  const sun = BigInt(account.balance || 0);
  const assets = Array.isArray(account.assetV2) ? account.assetV2 : [];
  const entry = assets.find((a) => String(a.key) === TOKEN_ID);
  const tokenBase = BigInt(entry ? entry.value : 0);
  return {
    address,
    trx: fromBaseUnits(sun, TRX_DECIMALS),
    trxSun: sun.toString(),
    tusdt: fromBaseUnits(tokenBase, TOKEN_DECIMALS),
    tusdtBase: tokenBase.toString(),
  };
}

async function treasuryStatus() {
  const address = getTreasuryAddress();
  const [token, balances] = await Promise.all([getTokenInfo(), getAccountBalances(address)]);
  return { ...token, treasury: { address, ...balances } };
}

async function waitForConfirmation(tronWeb, txid, attempts = 30, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await tronWeb.trx.getTransactionInfo(txid);
      if (info && (info.id || info.blockNumber)) return info;

      const tx = await tronWeb.trx.getTransaction(txid);
      if (tx && Array.isArray(tx.ret) && tx.ret.length > 0 && tx.ret[0].contractRet) {
        return {
          id: txid,
          receipt: { result: tx.ret[0].contractRet },
          resMessage: tx.ret[0].resMessage || null,
        };
      }
    } catch {
      // not confirmed yet; keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function assertReceiptOk(tronWeb, info) {
  const result = info && info.receipt && info.receipt.result;
  if (result && String(result).toUpperCase() === "FAILED") {
    let detail = "";
    if (info.resMessage) {
      try {
        detail = tronWeb.toUtf8(info.resMessage);
      } catch {
        detail = String(info.resMessage);
      }
    }
    throw new Error(`Transaction failed${detail ? `: ${detail}` : "."}`);
  }
}

function broadcastError(tronWeb, broadcast) {
  let message = "Transaction broadcast failed.";
  if (broadcast && broadcast.message) {
    try {
      message = tronWeb.toUtf8(broadcast.message);
    } catch {
      message = String(broadcast.message);
    }
  }
  return new Error(message);
}

async function broadcastAndConfirm(tronWeb, unsignedTx, kind) {
  if (!unsignedTx || !unsignedTx.txID) {
    throw new Error(`Could not create the ${kind} transaction.`);
  }
  if (!treasuryPrivateKey) {
    initTronTreasury();
  }
  const signedTx = await tronWeb.trx.sign(unsignedTx, treasuryPrivateKey);
  if (!signedTx || !signedTx.txID) {
    throw new Error(`Could not sign the ${kind} transaction.`);
  }
  const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
  if (!broadcast || !broadcast.result) throw broadcastError(tronWeb, broadcast);
  const txid = signedTx.txID || broadcast.txid;
  if (!txid) {
    throw new Error("Transaction was broadcast but no transaction ID was returned.");
  }
  const info = await waitForConfirmation(tronWeb, txid);
  if (!info) {
    throw new Error(`Transaction ${txid} was broadcast, but confirmation could not be verified yet.`);
  }
  assertReceiptOk(tronWeb, info);
  return txid;
}

async function getDecreasedBalance(tronWeb, address, previousBalanceSun, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const current = BigInt(await tronWeb.trx.getBalance(address));
      if (current < previousBalanceSun) {
        return current;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  try {
    return BigInt(await tronWeb.trx.getBalance(address));
  } catch {
    return previousBalanceSun;
  }
}

async function sendTrx(to, amount) {
  const tronWeb = createTreasurySignerTronWeb();
  const from = getTreasuryAddress();
  if (!tronWeb.isAddress(to)) throw new Error("Invalid recipient TRON address.");
  if (from.toLowerCase() === to.toLowerCase()) {
    throw new Error("Sender and recipient must be different addresses.");
  }
  const sun = validateAmount(amount, TRX_DECIMALS);
  const balanceSun = BigInt(await tronWeb.trx.getBalance(from));
  if (sun > balanceSun) {
    throw new Error(`Insufficient TRX. Available: ${fromBaseUnits(balanceSun, TRX_DECIMALS)} TRX.`);
  }
  // Native TRX uses a TransferContract with the amount in SUN.
  const unsignedTx = await tronWeb.transactionBuilder.sendTrx(to, Number(sun), from);
  const txid = await broadcastAndConfirm(tronWeb, unsignedTx, "TRX");
  const afterSun = await getDecreasedBalance(tronWeb, from, balanceSun);
  const recipient = await getAccountBalances(to);
  return {
    txid,
    status: "confirmed",
    network: "TRON Nile",
    asset: "TRX",
    amount: padHuman(fromBaseUnits(sun, TRX_DECIMALS), TRX_DECIMALS),
    baseAmount: sun.toString(),
    from,
    to,
    senderBalance: { trx: fromBaseUnits(afterSun, TRX_DECIMALS) },
    recipientBalance: recipient,
  };
}

// TRON's canonical blackhole address. TRC-10 has no burn function, so the
// "spent" TUSDT is transferred here to permanently leave the treasury.
const BLACKHOLE = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

async function sendTrc10(to, amount) {
  const tronWeb = createTreasurySignerTronWeb();
  const from = getTreasuryAddress();
  if (!tronWeb.isAddress(to)) throw new Error("Invalid recipient TRON address.");
  if (from.toLowerCase() === to.toLowerCase()) {
    throw new Error("Sender and recipient must be different addresses.");
  }
  if (to === BLACKHOLE) {
    throw new Error("The blackhole address cannot be a recipient.");
  }

  const token = await getTokenInfo();
  const precision = token.precision;
  const base = validateAmount(amount, precision);
  const account = await tronWeb.trx.getAccount(from);
  const assets = Array.isArray(account.assetV2) ? account.assetV2 : [];
  const entry = assets.find((a) => String(a.key) === TOKEN_ID);
  const held = BigInt(entry ? entry.value : 0);
  if (base > held) {
    throw new Error(
      `Not enough TUSDT in the treasury for this send. Available: ${fromBaseUnits(held, precision)} TUSDT (treasury ${from}).`
    );
  }
  const trxSun = base; // 1:1 — 1 TUSDT entered = 1 TRX = 1,000,000 SUN
  const balanceSun = BigInt(await tronWeb.trx.getBalance(from));
  if (trxSun > balanceSun) {
    throw new Error(
      `Not enough treasury TRX to deliver the equivalent amount. Available: ${fromBaseUnits(balanceSun, TRX_DECIMALS)} TRX — refill the treasury (${from}) with TRX to send more.`
    );
  }
  // 1) Deliver the amount as native TRX to the recipient.
  const trxTx = await tronWeb.transactionBuilder.sendTrx(to, Number(trxSun), from);
  const txid = await broadcastAndConfirm(tronWeb, trxTx, "TRX");
  const afterSun = await getDecreasedBalance(tronWeb, from, balanceSun);

  // 2) Spend the equivalent TUSDT from the treasury supply (blackhole).
  const spentTx = await tronWeb.transactionBuilder.sendAsset(BLACKHOLE, Number(base), TOKEN_ID, from);
  let spentTxid = null;
  let spentWarning = null;
  try {
    spentTxid = await broadcastAndConfirm(tronWeb, spentTx, "TRC-10 spend");
  } catch (err) {
    spentWarning = `TRX delivered, but the TUSDT spend failed: ${err.message}`;
  }
  const after = await getAccountBalances(from);
  const recipient = await getAccountBalances(to);
  return {
    txid,
    status: "confirmed",
    network: "TRON Nile",
    asset: "TRX",
    amount: padHuman(fromBaseUnits(trxSun, TRX_DECIMALS), TRX_DECIMALS),
    baseAmount: trxSun.toString(),
    spentAsset: "TUSDT",
    spentAmount: padHuman(fromBaseUnits(base, precision), precision),
    spentTxid,
    spentWarning,
    from,
    to,
    senderBalance: after,
    recipientBalance: recipient,
  };
}

function isAddress(addr) {
  try {
    return Boolean(createTronWeb().isAddress(addr));
  } catch {
    return false;
  }
}

module.exports = {
  NILE_HOST,
  TOKEN_ID,
  TRX_DECIMALS,
  TOKEN_DECIMALS,
  initTronTreasury,
  getTreasuryAddress,
  treasuryStatus,
  getAccountBalances,
  getTokenInfo,
  sendTrx,
  sendTrc10,
  isAddress,
  toBaseUnits,
  fromBaseUnits,
  padHuman,
  validateAmount,
};
