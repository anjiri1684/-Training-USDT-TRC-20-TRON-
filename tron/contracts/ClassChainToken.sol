// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ClassChainToken (TRC-20)
 * @notice Closed-loop classroom currency. Has NO real monetary value and is
 *         NOT redeemable for, or convertible into, any real-world asset.
 *
 *         Unlike a normal TRC-20, tokens can only move between addresses
 *         the owner (the platform's backend) has explicitly added as
 *         members via `addMember`. A transfer where either side is not a
 *         member reverts on-chain — enforced by the contract itself, not
 *         just by application-level checks.
 *
 *         Starts at zero supply. The owner mints directly to a student's
 *         address to represent a teacher distributing funds.
 */
contract ClassChainToken {
    string public constant name = "ClassChain Token";
    string public constant symbol = "CCT";
    uint8 public constant decimals = 6;

    address public owner;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isMember;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MemberAdded(address indexed account);
    event MemberRemoved(address indexed account);

    modifier onlyOwner() {
        require(msg.sender == owner, "ClassChainToken: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
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
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
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
        require(currentAllowance >= amount, "ClassChainToken: insufficient allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ClassChainToken: transfer from the zero address");
        require(to != address(0), "ClassChainToken: transfer to the zero address");
        require(isMember[from], "ClassChainToken: sender is not a member");
        require(isMember[to], "ClassChainToken: recipient is not a member");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "ClassChainToken: transfer amount exceeds balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "ClassChainToken: approve from the zero address");
        require(spender != address(0), "ClassChainToken: approve to the zero address");
        allowance[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
}
