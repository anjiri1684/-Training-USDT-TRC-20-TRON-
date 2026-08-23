
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

function treasuryKey() {
  const key = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_ADMIN_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "TRON_TREASURY_PRIVATE_KEY (or TRON_ADMIN_PRIVATE_KEY) must be set in backend/api/.env."
    );
  }
  return key;
}

function createTronWeb(privateKey) {
  assertNileHost();
  return privateKey
    ? new TronWeb({ fullHost: NILE_HOST, privateKey })
    : new TronWeb({ fullHost: NILE_HOST });
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

// Optional TRX top-up bundled with every TUSDT send (TRX_TOPUP_PER_SEND,
// in human TRX units, default off). The recipient gets native TRX so their
// wallet shows a TRX balance and can pay future transaction fees.
const TRX_TOPUP_MAX_SUN = 1_000_000_000_000n; // 1,000,000 TRX safety cap

function trxTopupSun() {
  const raw = process.env.TRX_TOPUP_PER_SEND;
  if (raw === undefined || raw === null || String(raw).trim() === "") return 0n;
  const sun = validateAmount(raw, TRX_DECIMALS);
  if (sun > TRX_TOPUP_MAX_SUN) {
    throw new Error("TRX_TOPUP_PER_SEND is unreasonably large (max 1,000,000 TRX).");
  }
  return sun;
}

function trxTopupInfo() {
  const sun = trxTopupSun();
  return { trx: fromBaseUnits(sun, TRX_DECIMALS), sun: sun.toString() };
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
  const key = treasuryKey();
  const tronWeb = createTronWeb(key);
  const address = tronWeb.defaultAddress.base58;
  const [token, balances] = await Promise.all([getTokenInfo(), getAccountBalances(address)]);
  return { ...token, treasury: { address, ...balances } };
}

async function waitForConfirmation(tronWeb, txid, attempts = 60, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await tronWeb.trx.getTransactionInfo(txid);
      if (info && info.id) return info;
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
  const signedTx = await tronWeb.trx.sign(unsignedTx, treasuryKey());
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

async function sendTrx(to, amount) {
  const key = treasuryKey();
  const tronWeb = createTronWeb(key);
  const from = tronWeb.defaultAddress.base58;
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
  const afterSun = BigInt(await tronWeb.trx.getBalance(from));
  if (afterSun >= balanceSun) {
    throw new Error(`Transaction ${txid} was confirmed, but the sender balance did not decrease as expected.`);
  }
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

async function sendTrc10(to, amount) {
  const key = treasuryKey();
  const tronWeb = createTronWeb(key);
  const from = tronWeb.defaultAddress.base58;
  if (!tronWeb.isAddress(to)) throw new Error("Invalid recipient TRON address.");
  if (from.toLowerCase() === to.toLowerCase()) {
    throw new Error("Sender and recipient must be different addresses.");
  }
  const token = await getTokenInfo();
  const precision = token.precision;
  const base = validateAmount(amount, precision);
  const account = await tronWeb.trx.getAccount(from);
  const assets = Array.isArray(account.assetV2) ? account.assetV2 : [];
  const entry = assets.find((a) => String(a.key) === TOKEN_ID);
  const held = BigInt(entry ? entry.value : 0);
  if (base > held) {
    throw new Error(`Insufficient TUSDT. Available: ${fromBaseUnits(held, precision)} TUSDT.`);
  }
  // TRC-10 uses a TransferAssetContract with the amount in base units.
  const unsignedTx = await tronWeb.transactionBuilder.sendAsset(to, Number(base), TOKEN_ID, from);
  const txid = await broadcastAndConfirm(tronWeb, unsignedTx, "TRC-10");
  const after = await getAccountBalances(from);
  if (BigInt(after.tusdtBase) >= held) {
    throw new Error(`Transaction ${txid} was confirmed, but the sender balance did not decrease as expected.`);
  }

  // Optional native TRX top-up for the recipient (separate transaction:
  // Nile rejects multi-contract transactions, so the TUSDT transfer and the
  // TRX top-up are two sequential transactions in this one request).
  let topupTxid = null;
  let topupTrx = null;
  const topupSun = trxTopupSun();
  if (topupSun > 0n) {
    const trxBalanceSun = BigInt(await tronWeb.trx.getBalance(from));
    if (topupSun > trxBalanceSun) {
      throw new Error(
        `TUSDT sent, but the TRX top-up of ${fromBaseUnits(topupSun, TRX_DECIMALS)} TRX failed: insufficient TRX (available ${fromBaseUnits(trxBalanceSun, TRX_DECIMALS)} TRX).`
      );
    }
    const topupTx = await tronWeb.transactionBuilder.sendTrx(to, Number(topupSun), from);
    topupTxid = await broadcastAndConfirm(tronWeb, topupTx, "TRX top-up");
    const afterSun = BigInt(await tronWeb.trx.getBalance(from));
    if (afterSun >= trxBalanceSun) {
      throw new Error(`TRX top-up ${topupTxid} was confirmed, but the sender balance did not decrease as expected.`);
    }
    topupTrx = padHuman(fromBaseUnits(topupSun, TRX_DECIMALS), TRX_DECIMALS);
  }

  const recipient = await getAccountBalances(to);
  return {
    txid,
    status: "confirmed",
    network: "TRON Nile",
    asset: "TUSDT",
    tokenId: TOKEN_ID,
    amount: padHuman(fromBaseUnits(base, precision), precision),
    baseAmount: base.toString(),
    topupTxid,
    topupTrx,
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
  treasuryStatus,
  getAccountBalances,
  getTokenInfo,
  sendTrx,
  sendTrc10,
  trxTopupInfo,
  isAddress,
  toBaseUnits,
  fromBaseUnits,
  padHuman,
  validateAmount,
};
