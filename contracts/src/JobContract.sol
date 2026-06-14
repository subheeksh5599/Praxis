// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationLedger {
    function recordJobCompletion(address agent, uint256 paymentAmount, uint256 rating) external;
    function recordDispute(address agent) external;
}

interface ISlashingEngine {
    function openDispute(address job, uint256 milestoneIndex, bytes32 evidenceHash) external;
}

interface IJobFactory {
    function incrementJobCount(address agent) external;
    function incrementDisputeCount(address agent) external;
    function recordJobCompletion(address agent, uint256 amount, uint256 rating) external;
    function recordDispute(address agent) external;
}

struct Milestone {
    string description;
    uint256 payment;
    uint256 deadline;
    bytes32 proofHash;
    bool completed;
    bool confirmed;
    bool disputed;
    uint256 completedAt;
}

contract JobContract {
    enum Status {
        Created,
        Accepted,
        InProgress,
        Completed,
        Disputed,
        Cancelled,
        Resolved
    }

    string public title;
    string public description;
    address public employer;
    address public agent;
    Status public status;
    uint256 public totalPayment;
    uint256 public releasedPayment;
    uint256 public acceptedAt;
    uint256 public completedAt;
    uint256 public disputeCount;

    Milestone[] public milestones;
    address public factory;
    address public slashingEngine;
    IReputationLedger public reputation;

    event JobAccepted(address indexed agent, uint256 timestamp);
    event MilestoneSubmitted(uint256 indexed index, bytes32 proofHash, uint256 timestamp);
    event MilestoneConfirmed(uint256 indexed index, uint256 payment, uint256 rating);
    event MilestoneDisputed(uint256 indexed index, bytes32 evidenceHash);
    event PaymentReleased(address indexed to, uint256 amount);
    event JobCompleted(address indexed agent, uint256 totalPayment);
    event JobCancelled(address indexed employer);
    event DeadlineExtended(uint256 indexed index, uint256 newDeadline);

    error OnlyAgent();
    error OnlyEmployer();
    error InvalidStatus();
    error InsufficientPayment();
    error DeadlineExpired();
    error MilestoneAlreadyCompleted();
    error MilestoneAlreadyConfirmed();
    error NotAllMilestonesComplete();
    error TransferFailed();
    error InvalidMilestoneIndex();

    modifier onlyAgent() {
        if (msg.sender != agent) revert OnlyAgent();
        _;
    }

    modifier onlyEmployer() {
        if (msg.sender != employer) revert OnlyEmployer();
        _;
    }

    modifier inStatus(Status _status) {
        if (status != _status) revert InvalidStatus();
        _;
    }

    constructor(
        address _employer,
        address _agent,
        string memory _title,
        string memory _description,
        MilestoneInput[] memory _milestoneInputs,
        address _slashingEngine,
        address _reputation
    ) payable {
        employer = _employer;
        agent = _agent;
        title = _title;
        description = _description;
        factory = msg.sender;
        slashingEngine = _slashingEngine;
        reputation = IReputationLedger(_reputation);

        uint256 total;
        for (uint256 i = 0; i < _milestoneInputs.length; i++) {
            milestones.push(Milestone({
                description: _milestoneInputs[i].description,
                payment: _milestoneInputs[i].payment,
                deadline: _milestoneInputs[i].deadline,
                proofHash: bytes32(0),
                completed: false,
                confirmed: false,
                disputed: false,
                completedAt: 0
            }));
            total += _milestoneInputs[i].payment;
        }
        totalPayment = total;

        if (msg.value < total) revert InsufficientPayment();

        status = Status.Created;
    }

    function acceptJob() external onlyAgent inStatus(Status.Created) {
        status = Status.InProgress;
        acceptedAt = block.timestamp;
        emit JobAccepted(agent, block.timestamp);
    }

    function submitMilestone(
        uint256 _index,
        bytes32 _proofHash
    ) external onlyAgent {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        Milestone storage m = milestones[_index];
        if (m.completed) revert MilestoneAlreadyCompleted();
        if (status != Status.InProgress && status != Status.Accepted) revert InvalidStatus();

        m.completed = true;
        m.proofHash = _proofHash;
        m.completedAt = block.timestamp;

        emit MilestoneSubmitted(_index, _proofHash, block.timestamp);
    }

    function confirmMilestone(
        uint256 _index,
        uint256 _rating
    ) external onlyEmployer {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        Milestone storage m = milestones[_index];
        if (!m.completed) revert MilestoneAlreadyCompleted();
        if (m.confirmed) revert MilestoneAlreadyConfirmed();

        m.confirmed = true;
        releasedPayment += m.payment;

        bool success;
        (success, ) = agent.call{value: m.payment}("");
        if (!success) revert TransferFailed();

        IJobFactory(factory).incrementJobCount(agent);
        IJobFactory(factory).recordJobCompletion(agent, m.payment, _rating);

        emit MilestoneConfirmed(_index, m.payment, _rating);
        emit PaymentReleased(agent, m.payment);

        if (_allMilestonesConfirmed()) {
            status = Status.Completed;
            completedAt = block.timestamp;
            emit JobCompleted(agent, totalPayment);
        }
    }

    function disputeMilestone(
        uint256 _index,
        bytes32 _evidenceHash
    ) external onlyEmployer {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        Milestone storage m = milestones[_index];
        if (!m.completed) revert MilestoneAlreadyCompleted();
        if (m.confirmed) revert MilestoneAlreadyConfirmed();
        if (m.disputed) revert MilestoneAlreadyCompleted();

        m.disputed = true;
        status = Status.Disputed;
        disputeCount++;

        ISlashingEngine(slashingEngine).openDispute(address(this), _index, _evidenceHash);
        emit MilestoneDisputed(_index, _evidenceHash);
    }

    function resolveDispute(uint256 _index) external {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        if (msg.sender != slashingEngine) revert OnlyAgent(); // reuse error

        status = Status.Resolved;
    }

    function extendDeadline(
        uint256 _index,
        uint256 _newDeadline
    ) external onlyEmployer {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        milestones[_index].deadline = _newDeadline;
        emit DeadlineExtended(_index, _newDeadline);
    }

    function cancelJob() external onlyEmployer inStatus(Status.Created) {
        status = Status.Cancelled;
        (bool success, ) = employer.call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
        emit JobCancelled(employer);
    }

    function getJobDetails() external view returns (
        string memory _title,
        string memory _description,
        address _employer,
        address _agent,
        Status _status,
        uint256 _totalPayment,
        uint256 _releasedPayment,
        uint256 _acceptedAt,
        uint256 _completedAt
    ) {
        return (title, description, employer, agent, status, totalPayment, releasedPayment, acceptedAt, completedAt);
    }

    function getMilestone(uint256 _index) external view returns (Milestone memory) {
        if (_index >= milestones.length) revert InvalidMilestoneIndex();
        return milestones[_index];
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getAllMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }

    function _allMilestonesConfirmed() internal view returns (bool) {
        for (uint256 i = 0; i < milestones.length; i++) {
            if (!milestones[i].confirmed) return false;
        }
        return true;
    }

    receive() external payable {}
}

struct MilestoneInput {
    string description;
    uint256 payment;
    uint256 deadline;
}
