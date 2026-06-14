// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {JobContract, MilestoneInput} from "./JobContract.sol";

interface IReputationLedger {
    function recordJobCompletion(address agent, uint256 paymentAmount, uint256 rating) external;
    function recordDispute(address agent) external;
}

interface IAgentRegistry {
    function isRegistered(address agent) external view returns (bool);
    function agents(address agent) external view returns (uint256 id, address owner, string memory name, string memory description, uint256 pricePerMilestone, bool isActive, uint256 registeredAt, uint256 totalJobsCompleted, uint256 totalJobsDisputed, string memory metadataURI);
    function getAgentsSortedByScore(string calldata skill, uint256 maxPrice, uint256 limit) external view returns (Agent[] memory, uint256[] memory);
    function incrementJobCount(address agent) external;
    function incrementDisputeCount(address agent) external;
}

struct Agent {
    uint256 id;
    address owner;
    string name;
    string description;
    string[] skills;
    uint256 pricePerMilestone;
    bool isActive;
    uint256 registeredAt;
    uint256 totalJobsCompleted;
    uint256 totalJobsDisputed;
    string metadataURI;
}

struct JobListing {
    address jobAddress;
    address employer;
    address agent;
    string title;
    uint256 totalPayment;
    uint8 milestoneCount;
    uint8 status;
    uint256 createdAt;
}

contract JobFactory {
    IAgentRegistry public registry;
    address public slashingEngine;
    address public reputationLedger;
    address public admin;

    address[] public allJobs;
    mapping(address => address[]) public jobsByEmployer;
    mapping(address => address[]) public jobsByAgent;
    mapping(address => JobListing) public listings;

    event JobCreated(
        address indexed job,
        address indexed employer,
        address indexed agent,
        string title,
        uint256 totalPayment,
        uint8 milestoneCount
    );

    error AgentNotRegistered();
    error AgentNotActive();
    error InvalidMilestones();
    error InvalidPayment();
    error NotAdmin();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(
        address _registry,
        address _slashingEngine,
        address _reputation
    ) {
        registry = IAgentRegistry(_registry);
        slashingEngine = _slashingEngine;
        reputationLedger = _reputation;
        admin = msg.sender;
    }

    function createJob(
        address _agent,
        string calldata _title,
        string calldata _description,
        MilestoneInput[] calldata _milestones,
        string calldata /* _metadataURI */
    ) external payable returns (address) {
        if (!registry.isRegistered(_agent)) revert AgentNotRegistered();

        (, , , , , bool isActive, , , , ) = registry.agents(_agent);
        if (!isActive) revert AgentNotActive();

        if (_milestones.length == 0) revert InvalidMilestones();

        uint256 total;
        for (uint256 i = 0; i < _milestones.length; i++) {
            total += _milestones[i].payment;
        }

        if (msg.value < total) revert InvalidPayment();

        JobContract job = new JobContract{value: total}(
            msg.sender,
            _agent,
            _title,
            _description,
            _milestones,
            slashingEngine,
            reputationLedger
        );

        address jobAddr = address(job);
        allJobs.push(jobAddr);
        jobsByEmployer[msg.sender].push(jobAddr);
        jobsByAgent[_agent].push(jobAddr);

        listings[jobAddr] = JobListing({
            jobAddress: jobAddr,
            employer: msg.sender,
            agent: _agent,
            title: _title,
            totalPayment: total,
            milestoneCount: uint8(_milestones.length),
            status: 0,
            createdAt: block.timestamp
        });

        emit JobCreated(jobAddr, msg.sender, _agent, _title, total, uint8(_milestones.length));
        return jobAddr;
    }

    function incrementJobCount(address agent) external {
        registry.incrementJobCount(agent);
    }

    function incrementDisputeCount(address agent) external {
        registry.incrementDisputeCount(agent);
    }

    function setRegistry(address _registry) external onlyAdmin {
        registry = IAgentRegistry(_registry);
    }

    function recordJobCompletion(
        address agent,
        uint256 paymentAmount,
        uint256 rating
    ) external {
        // Only allow calls from JobContracts deployed by this factory
        IReputationLedger(reputationLedger).recordJobCompletion(agent, paymentAmount, rating);
    }

    function recordDispute(address agent) external {
        IReputationLedger(reputationLedger).recordDispute(agent);
    }
}
