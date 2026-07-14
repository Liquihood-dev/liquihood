// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  MockERC20
 * @notice Mintable ERC-20 for Liquihood testnet assets.
 *         The deployer (owner) can mint to any address.
 *         Any user can call faucet() to receive a fixed drip.
 */
contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;
    address public owner;

    /// @notice Max tokens per faucet call (1 000 tokens).
    uint256 public faucetAmount = 1_000 * 1e18;
    /// @notice Cooldown between faucet calls per address (1 hour).
    uint256 public faucetCooldown = 1 hours;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastFaucet;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner_, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _owner) {
        require(_owner != address(0), "MockERC20: zero owner");
        name  = _name;
        symbol = _symbol;
        owner = _owner;
    }

    // ── ERC-20 core ────────────────────────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    // ── Mint / Faucet ──────────────────────────────────────────────────────────

    /// @notice Owner can mint any amount to any address.
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "MockERC20: not owner");
        _mint(to, amount);
    }

    /// @notice Any address can claim `faucetAmount` once per `faucetCooldown`.
    function faucet() external {
        require(
            block.timestamp >= lastFaucet[msg.sender] + faucetCooldown,
            "MockERC20: cooldown active"
        );
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }

    // ── Owner config ───────────────────────────────────────────────────────────

    function setFaucetParams(uint256 _amount, uint256 _cooldown) external {
        require(msg.sender == owner, "MockERC20: not owner");
        faucetAmount   = _amount;
        faucetCooldown = _cooldown;
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "MockERC20: not owner");
        require(newOwner != address(0), "MockERC20: zero address");
        owner = newOwner;
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply     += amount;
        balanceOf[to]   += amount;
        emit Transfer(address(0), to, amount);
    }
}
