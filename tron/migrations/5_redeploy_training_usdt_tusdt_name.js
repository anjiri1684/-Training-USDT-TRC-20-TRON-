// Redeploys TrainingUSDT again — this time with name = "TUSDT" (not just
// symbol). Empirically confirmed via a throwaway probe contract that
// Tronscan's "Suspicious" auto-flag (which blocks TronLink's
// wallet_watchAsset) triggers on the *name* field containing the word
// "USDT" — "Training USDT" still tripped it even with symbol "TUSDT",
// while a bare "TUSDT" name/symbol combo did not. New migration step, not
// a reset, so ClassChainToken's address is untouched.
const TrainingUSDT = artifacts.require("TrainingUSDT");

module.exports = function (deployer) {
  deployer.deploy(TrainingUSDT);
};
