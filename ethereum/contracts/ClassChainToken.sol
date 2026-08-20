// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClassChainToken
 * @notice Closed-loop classroom currency. Has NO real monetary value and is
 *         NOT redeemable for, or convertible into, any real-world asset.
 *
 *         Unlike a normal ERC-20, tokens can only move between addresses
 *         the owner (the platform's backend) has explicitly added as
 *         members via `addMember`. A transfer where either side is not a
 *         member reverts on-chain — this is the actual guarantee that
 *         tokens cannot reach an external wallet, exchange, or any address
 *         outside the class, enforced by the contract itself rather than
 *         by application-level checks that a bug could bypass.
 *
 *         Starts at zero supply. The owner mints directly to a student's
 *         address to represent a teacher distributing funds.
 */
contract ClassChainToken is ERC20, Ownable {
    uint8 private constant TOKEN_DECIMALS = 6;

    mapping(address => bool) public isMember;

    event MemberAdded(address indexed account);
    event MemberRemoved(address indexed account);

    constructor(address initialOwner)
        ERC20("ClassChain Token", "CCT")
        Ownable(initialOwner)
    {}

    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function addMember(address account) external onlyOwner {
        isMember[account] = true;
        emit MemberAdded(account);
    }

    function removeMember(address account) external onlyOwner {
        isMember[account] = false;
        emit MemberRemoved(account);
    }

    /// @notice Mints new tokens directly to a member — represents the
    /// teacher distributing funds. The recipient must already be a member.
    function mint(address to, uint256 amount) external onlyOwner {
        require(isMember[to], "ClassChainToken: recipient is not a member");
        _mint(to, amount);
    }

    /// @dev Enforces the closed-loop restriction on every transfer. Mint
    /// (from == address(0)) and burn (to == address(0)) are exempted from
    /// the "from" / "to" side that doesn't apply to them.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            require(isMember[from], "ClassChainToken: sender is not a member");
        }
        if (to != address(0)) {
            require(isMember[to], "ClassChainToken: recipient is not a member");
        }
        super._update(from, to, value);
    }
}
