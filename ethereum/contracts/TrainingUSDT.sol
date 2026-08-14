// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TrainingUSDT
 * @notice Educational/training token only, deployed on Ethereum Sepolia testnet.
 *         This token is NOT issued by, affiliated with, or backed by Tether
 *         Limited or any real-world asset. It has NO monetary value.
 *
 *         `simulatedUsdPrice()` exposes a fixed reference value used ONLY by
 *         this project's own training interface to display an illustrative
 *         "$X simulated value" figure (1 tUSDT = $1). It does not register
 *         with, and is not read by, MetaMask, Trust Wallet, CoinMarketCap,
 *         or any other third-party wallet or price provider.
 */
contract TrainingUSDT is ERC20 {

    /// @dev Simulated reference price, expressed with 6 decimals (1_000_000 = $1.00).
    uint256 public constant SIMULATED_USD_PRICE = 1_000_000;
    uint8 private constant TOKEN_DECIMALS = 6;

    constructor() ERC20("Training USDT", "USDT") {
        // 100,000,000 tokens, using 6 decimals, minted entirely to the deployer.
        _mint(msg.sender, 100_000_000 * 10 ** TOKEN_DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    /**
     * @dev Educational reference only. Returns a fixed simulated USD value
     * (6 decimals) for use in this project's own training UI. This does NOT
     * establish, report, or influence any real market price.
     */
    function simulatedUsdPrice() external pure returns (uint256) {
        return SIMULATED_USD_PRICE;
    }
}
