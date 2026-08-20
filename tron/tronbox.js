require("dotenv").config();

const NILE_PRIVATE_KEY = process.env.NILE_PRIVATE_KEY || "";

module.exports = {
  networks: {
    // Local private TRON network simulation (tronbox/tre Docker image).
    // No real accounts, no real TRX, no public network involved.
    development: {
      // NOTE: tronbox/tre generates a fresh random mnemonic/accounts every
      // time the container starts (unlike Hardhat's fixed defaults). After
      // `docker run ... tronbox/tre`, check `docker logs <container>` for
      // "Available Accounts" / "Private Keys" and paste Account #0's key
      // here before deploying.
      privateKey:
        "1cf231f10c8dd1aaa7c2cd2a0e90c99bfcf51947c8138b0fab00f5de520a5b20",
      userFeePercentage: 0,
      feeLimit: 1_000_000_000,
      fullHost: "http://127.0.0.1:9090",
      network_id: "9",
    },

    // TRON's public Nile testnet. Real network, real TronLink/Trust Wallet
    // apps can interact with it, but Nile TRX has no real value — get free
    // Nile TRX from https://nileex.io/join/getJoinPage before deploying.
    nile: {
      privateKey: NILE_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1_000_000_000,
      fullHost: "https://nile.trongrid.io",
      network_id: "3",
    },
  },
  compilers: {
    solc: {
      version: "0.8.24",
    },
  },
};
