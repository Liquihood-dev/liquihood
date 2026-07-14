// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ProtocolNameRegistry
 * @notice ENS-compatible name registry for the Liquihood protocol on Robinhood Chain.
 *
 *         Maps human-readable names (e.g. "pool.liquihood") to contract addresses using
 *         the same namehash algorithm as ENS (EIP-137), so any ENS-aware tooling can
 *         resolve Liquihood contract addresses on Robinhood Chain without touching
 *         Ethereum mainnet.
 *
 *         The registry owner can register and update names; anyone can resolve them.
 *
 * @author Liquihood Protocol
 */
contract ProtocolNameRegistry {

    // ── Events ────────────────────────────────────────────────────────────────

    event NameRegistered(bytes32 indexed node, string name, address indexed addr);
    event NameUpdated(bytes32 indexed node, string name, address indexed oldAddr, address indexed newAddr);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Storage ───────────────────────────────────────────────────────────────

    address public owner;

    /// namehash → resolved address
    mapping(bytes32 => address) public resolver;

    /// namehash → human-readable name (for reverse lookup / UI display)
    mapping(bytes32 => string) public names;

    /// all registered nodes (for enumeration)
    bytes32[] public allNodes;

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) {
        require(_owner != address(0), "ProtocolNameRegistry: zero owner");
        owner = _owner;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ProtocolNameRegistry: caller is not owner");
        _;
    }

    // ── Name hashing (EIP-137 namehash) ──────────────────────────────────────

    /**
     * @notice Compute the ENS namehash of a dot-separated name.
     *         namehash("") = 0x000…0
     *         namehash("liquihood") = keccak256(namehash("") ‖ keccak256("liquihood"))
     *         namehash("pool.liquihood") = keccak256(namehash("liquihood") ‖ keccak256("pool"))
     * @param  name  Dot-separated name string, e.g. "pool.liquihood"
     */
    function namehash(string memory name) public pure returns (bytes32 node) {
        bytes memory nameBytes = bytes(name);
        uint256 len = nameBytes.length;

        if (len == 0) return bytes32(0);

        // Split into labels right-to-left and iteratively hash
        node = bytes32(0);
        uint256 end = len;
        for (uint256 i = len; i > 0; ) {
            unchecked { --i; }
            if (nameBytes[i] == bytes1(".") || i == 0) {
                uint256 start = (nameBytes[i] == bytes1(".")) ? i + 1 : 0;
                uint256 labelLen = end - start;
                bytes memory label = new bytes(labelLen);
                for (uint256 j = 0; j < labelLen; j++) {
                    label[j] = nameBytes[start + j];
                }
                node = keccak256(abi.encodePacked(node, keccak256(label)));
                end = i; // move end to before the dot
            }
        }
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new name → address mapping.
     * @param  name  Human-readable name, e.g. "pool.liquihood"
     * @param  addr  Contract address to associate with this name
     */
    function register(string calldata name, address addr) external onlyOwner {
        require(addr != address(0), "ProtocolNameRegistry: zero address");
        bytes32 node = namehash(name);
        require(resolver[node] == address(0), "ProtocolNameRegistry: name already registered");

        resolver[node] = addr;
        names[node]    = name;
        allNodes.push(node);

        emit NameRegistered(node, name, addr);
    }

    /**
     * @notice Update the address for an existing name.
     * @param  name  Human-readable name to update
     * @param  addr  New contract address
     */
    function update(string calldata name, address addr) external onlyOwner {
        require(addr != address(0), "ProtocolNameRegistry: zero address");
        bytes32 node = namehash(name);
        address old  = resolver[node];
        require(old != address(0), "ProtocolNameRegistry: name not found");

        resolver[node] = addr;
        emit NameUpdated(node, name, old, addr);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * @notice Resolve a name to its contract address.
     * @param  name  Human-readable name, e.g. "pool.liquihood"
     * @return addr  Resolved address, or address(0) if not registered
     */
    function resolve(string calldata name) external view returns (address addr) {
        return resolver[namehash(name)];
    }

    /**
     * @notice Resolve a namehash directly.
     * @param  node  ENS namehash
     * @return addr  Resolved address, or address(0) if not registered
     */
    function resolveNode(bytes32 node) external view returns (address addr) {
        return resolver[node];
    }

    /**
     * @notice Return all registered (node, name, address) tuples for UI enumeration.
     */
    function getAllEntries()
        external
        view
        returns (
            bytes32[] memory nodes,
            string[]  memory nameList,
            address[] memory addrs
        )
    {
        uint256 count = allNodes.length;
        nodes    = new bytes32[](count);
        nameList = new string[](count);
        addrs    = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            bytes32 node = allNodes[i];
            nodes[i]    = node;
            nameList[i] = names[node];
            addrs[i]    = resolver[node];
        }
    }

    /**
     * @notice Total number of registered names.
     */
    function totalNames() external view returns (uint256) {
        return allNodes.length;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Transfer registry ownership.
     * @param  newOwner  Address of new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ProtocolNameRegistry: zero address");
        address prev = owner;
        owner = newOwner;
        emit OwnerTransferred(prev, newOwner);
    }
}
