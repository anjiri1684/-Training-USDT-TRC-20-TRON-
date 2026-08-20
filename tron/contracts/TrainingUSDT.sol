// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TrainingUSDT (TRC-20)
 * @notice Educational/training token only, deployed on a local private TRON
 *         network simulation. This token is NOT issued by, affiliated with,
 *         or backed by Tether Limited or any real-world asset. It has NO
 *         monetary value.
 *
 *         Implements the standard TRC-20 interface (identical in shape to
 *         ERC-20) directly, without external imports, for straightforward
 *         compilation under TVM.
 *
 *         `simulatedUsdPrice()` exposes a fixed reference value used ONLY by
 *         this project's own training interface to display an illustrative
 *         "$X simulated value" figure (1 USDT = $1). It does not register
 *         with, and is not read by, TronLink, Trust Wallet, CoinMarketCap,
 *         or any other third-party wallet or price provider.
 */
contract TrainingUSDT {
    string public constant name = "TUSDT";
    string public constant symbol = "TUSDT";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @dev Simulated reference price, expressed with 6 decimals (1_000_000 = $1.00).
    uint256 public constant SIMULATED_USD_PRICE = 1_000_000;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        totalSupply = 100_000_000 * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "TRC20: insufficient allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Educational reference only. Returns a fixed simulated USD value
     * (6 decimals) for use in this project's own training UI. This does NOT
     * establish, report, or influence any real market price.
     */
    function simulatedUsdPrice() external pure returns (uint256) {
        return SIMULATED_USD_PRICE;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "TRC20: transfer from the zero address");
        require(to != address(0), "TRC20: transfer to the zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "TRC20: transfer amount exceeds balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "TRC20: approve from the zero address");
        require(spender != address(0), "TRC20: approve to the zero address");
        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
