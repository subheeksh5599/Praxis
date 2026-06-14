// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakeVaultSlashing {
    function slashStake(address agent, uint256 amount, address recipient) external;
}

interface IReputationLedgerSlashing {
    function recordDispute(address agent) external;
}

interface IJobContract {
    function milestones(uint256 index) external view returns (
        string memory description,
        uint256 payment,
        uint256 deadline,
        bytes32 proofHash,
        bool completed,
        bool confirmed,
        bool disputed,
        uint256 completedAt
    );
}

struct Dispute {
    address job;
    uint256 milestoneIndex;
    address employer;
    address agent;
    bytes32 evidenceHash;
    uint256 openedAt;
    bool resolved;
    bool agentAtFault;
    uint256 resolvedAt;
}

contract SlashingEngine {
    IStakeVaultSlashing public stakeVault;
    IReputationLedgerSlashing public reputation;
    address public admin;

    uint256 public disputeCount;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => mapping(uint256 => bool)) public hasDispute;

    uint256 public slashPercentage = 50; // 50% of stake slashed
    uint256 public constant MAX_SLASH = 50 ether;
    uint256 public disputeWindow = 7 days;

    event DisputeOpened(
        uint256 indexed disputeId,
        address indexed job,
        uint256 milestoneIndex,
        address indexed agent,
        bytes32 evidenceHash
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        bool agentAtFault,
        uint256 slashAmount,
        address indexed victim
    );

    error NotAdmin();
    error AlreadyDisputed();
    error DisputeNotFound();
    error AlreadyResolved();
    error DisputeWindowExpired();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _stakeVault, address _reputation) {
        admin = msg.sender;
        stakeVault = IStakeVaultSlashing(_stakeVault);
        reputation = IReputationLedgerSlashing(_reputation);
    }

    function openDispute(
        address _job,
        uint256 _milestoneIndex,
        bytes32 _evidenceHash
    ) external {
        if (hasDispute[_job][_milestoneIndex]) revert AlreadyDisputed();

        uint256 id = disputeCount++;
        disputes[id] = Dispute({
            job: _job,
            milestoneIndex: _milestoneIndex,
            employer: msg.sender,
            agent: address(0), // populated by resolve
            evidenceHash: _evidenceHash,
            openedAt: block.timestamp,
            resolved: false,
            agentAtFault: false,
            resolvedAt: 0
        });

        hasDispute[_job][_milestoneIndex] = true;

        emit DisputeOpened(id, _job, _milestoneIndex, address(0), _evidenceHash);
    }

    function resolveDispute(
        uint256 _disputeId,
        address _agent,
        bool _agentAtFault
    ) external onlyAdmin {
        if (_disputeId >= disputeCount) revert DisputeNotFound();

        Dispute storage d = disputes[_disputeId];
        if (d.resolved) revert AlreadyResolved();

        d.agent = _agent;
        d.resolved = true;
        d.agentAtFault = _agentAtFault;
        d.resolvedAt = block.timestamp;

        uint256 slashAmount;
        if (_agentAtFault) {
            reputation.recordDispute(_agent);
            slashAmount = _calculateSlash(_agent);
            if (slashAmount > 0) {
                address victim = d.employer;
                stakeVault.slashStake(_agent, slashAmount, victim);
            }
        }

        emit DisputeResolved(_disputeId, _agentAtFault, slashAmount, d.employer);
    }

    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        if (_disputeId >= disputeCount) revert DisputeNotFound();
        return disputes[_disputeId];
    }

    function _calculateSlash(address /* _agent */) internal view returns (uint256) {
        // In production, dynamic slash based on job value
        return MAX_SLASH * slashPercentage / 100;
    }

    function setSlashPercentage(uint256 _pct) external onlyAdmin {
        if (_pct > 100) revert();
        slashPercentage = _pct;
    }

    function setDisputeWindow(uint256 _window) external onlyAdmin {
        disputeWindow = _window;
    }

    function setStakeVault(address _stakeVault) external onlyAdmin {
        stakeVault = IStakeVaultSlashing(_stakeVault);
    }

    function setReputation(address _reputation) external onlyAdmin {
        reputation = IReputationLedgerSlashing(_reputation);
    }
}
