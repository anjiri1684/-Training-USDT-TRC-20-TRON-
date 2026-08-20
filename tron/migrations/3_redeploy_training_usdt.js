// Redeploys TrainingUSDT as a fresh instance now that its symbol changed
// from "USDT" (flagged "Suspicious" by Tronscan as a fake-Tether lookalike,
// which blocked TronLink from registering it as a recognized asset) to
// "TUSDT". Deliberately a new migration step, not a reset of 1_ or 2_, so
// the already-deployed ClassChainToken contract and its address are
// untouched.
const TrainingUSDT = artifacts.require("TrainingUSDT");

module.exports = function (deployer) {
  deployer.deploy(TrainingUSDT);
};
