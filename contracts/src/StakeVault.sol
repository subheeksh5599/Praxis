// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StakeVault {
    mapping(address => uint256) public stakes;
    mapping(address => uint256) public lockedStakes;
    mapping(address => uint256) public totalStaked;
    address public slashingEngine;
    address public admin;

    event Staked(address indexed agent, uint256 amount);
    event Unstaked(address indexed agent, uint256 amount);
    event Slashed(address indexed agent, uint256 amount, address indexed recipient);
    event SlashingEngineUpdated(address indexed newEngine);

    error NotAdmin();
    error NotSlashingEngine();
    error InsufficientStake();
    error UnstakeAmountExceedsFree();
    error ZeroAmount();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlySlashingEngine() {
        if (msg.sender != slashingEngine) revert NotSlashingEngine();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function stake(address agent) external payable {
        if (msg.value == 0) revert ZeroAmount();
        stakes[agent] += msg.value;
        totalStaked[agent] += msg.value;
        emit Staked(agent, msg.value);
    }

    function unstake(address agent, uint256 amount) external {
        if (msg.sender != agent && msg.sender != admin) revert NotSlashingEngine();
        if (amount == 0) revert ZeroAmount();

        uint256 freeStake = stakes[agent] - lockedStakes[agent];
        if (amount > freeStake) revert UnstakeAmountExceedsFree();

        stakes[agent] -= amount;
        totalStaked[agent] -= amount;
        payable(agent).transfer(amount);
        emit Unstaked(agent, amount);
    }

    function lockStake(address agent, uint256 amount) external onlyAdmin {
        if (amount > stakes[agent] - lockedStakes[agent]) revert InsufficientStake();
        lockedStakes[agent] += amount;
    }

    function unlockStake(address agent, uint256 amount) external onlyAdmin {
        if (amount > lockedStakes[agent]) revert InsufficientStake();
        lockedStakes[agent] -= amount;
    }

    function slashStake(address agent, uint256 amount, address recipient) external onlySlashingEngine {
        if (amount == 0) revert ZeroAmount();
        if (amount > stakes[agent]) revert InsufficientStake();

        stakes[agent] -= amount;
        totalStaked[agent] -= amount;
        if (lockedStakes[agent] > stakes[agent]) {
            lockedStakes[agent] = stakes[agent];
        }

        payable(recipient).transfer(amount);
        emit Slashed(agent, amount, recipient);
    }

    function getStake(address agent) external view returns (uint256) {
        return stakes[agent];
    }

    function getFreeStake(address agent) external view returns (uint256) {
        return stakes[agent] - lockedStakes[agent];
    }

    function getTotalStaked(address agent) external view returns (uint256) {
        return totalStaked[agent];
    }

    function setSlashingEngine(address _engine) external onlyAdmin {
        slashingEngine = _engine;
        emit SlashingEngineUpdated(_engine);
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }
}
