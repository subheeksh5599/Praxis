// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakeVault {
    function getStake(address agent) external view returns (uint256);
    function getTotalStaked(address agent) external view returns (uint256);
}

struct Reputation {
    uint256 totalJobsCompleted;
    uint256 totalJobsDisputed;
    uint256 totalValueCompleted;
    uint256 totalDisputeValue;
    uint256 averageRating;
    uint256 ratingCount;
    uint256 lastUpdatedAt;
    uint256 creditScore;
}

contract ReputationLedger {
    mapping(address => Reputation) public reputations;
    address public admin;
    mapping(address => bool) public isAuthorized;

    uint256 public constant DECAY_PERIOD = 30 days;
    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant MAX_VOLUME = 1000 ether;
    uint256 public constant MAX_STAKE = 100 ether;
    uint256 public constant RATING_SCALE = 500;

    uint256 public constant COMPLETION_WEIGHT = 350;
    uint256 public constant RATING_WEIGHT = 250;
    uint256 public constant VOLUME_WEIGHT = 200;
    uint256 public constant STAKE_WEIGHT = 200;

    IStakeVault public stakeVault;

    event ReputationUpdated(
        address indexed agent,
        uint256 totalJobs,
        uint256 totalValue,
        uint256 averageRating,
        uint256 creditScore
    );
    event DisputeRecorded(address indexed agent, uint256 totalDisputes);

    error NotAuthorized();
    error ZeroRating();

    modifier onlyAuthorized() {
        if (!isAuthorized[msg.sender] && msg.sender != admin) revert NotAuthorized();
        _;
    }

    constructor(address _stakeVault) {
        admin = msg.sender;
        stakeVault = IStakeVault(_stakeVault);
    }

    function setAuthorized(address caller, bool authorized) external {
        if (msg.sender != admin) revert NotAuthorized();
        isAuthorized[caller] = authorized;
    }

    function recordJobCompletion(
        address agent,
        uint256 paymentAmount,
        uint256 rating
    ) external onlyAuthorized {
        if (rating < 100 || rating > RATING_SCALE) revert ZeroRating();

        Reputation storage rep = reputations[agent];
        rep.totalJobsCompleted++;
        rep.totalValueCompleted += paymentAmount;

        uint256 totalRating = rep.averageRating * rep.ratingCount + rating;
        rep.ratingCount++;
        rep.averageRating = totalRating / rep.ratingCount;
        rep.lastUpdatedAt = block.timestamp;

        rep.creditScore = _calculateScore(agent, rep);

        emit ReputationUpdated(
            agent,
            rep.totalJobsCompleted,
            rep.totalValueCompleted,
            rep.averageRating,
            rep.creditScore
        );
    }

    function recordDispute(address agent) external onlyAuthorized {
        Reputation storage rep = reputations[agent];
        rep.totalJobsDisputed++;
        rep.lastUpdatedAt = block.timestamp;

        rep.creditScore = _calculateScore(agent, rep);

        emit DisputeRecorded(agent, rep.totalJobsDisputed);
    }

    function getReputation(address agent) external view returns (Reputation memory) {
        return reputations[agent];
    }

    function getCreditScore(address agent) public view returns (uint256) {
        Reputation storage rep = reputations[agent];
        if (rep.totalJobsCompleted == 0 && rep.totalJobsDisputed == 0) return 0;
        return _calculateScore(agent, rep);
    }

    function getCreditTier(address agent) external view returns (string memory tier, uint256 score) {
        score = getCreditScore(agent);
        if (score >= 800) tier = "Diamond";
        else if (score >= 600) tier = "Platinum";
        else if (score >= 400) tier = "Gold";
        else if (score >= 200) tier = "Silver";
        else tier = "Bronze";
    }

    function getTopAgents(address[] calldata _agents) external view returns (address[] memory, uint256[] memory) {
        uint256 count = _agents.length;
        address[] memory ranked = new address[](count);
        uint256[] memory scores = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            ranked[i] = _agents[i];
            scores[i] = getCreditScore(_agents[i]);
        }

        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (scores[j] > scores[i]) {
                    (ranked[i], ranked[j]) = (ranked[j], ranked[i]);
                    (scores[i], scores[j]) = (scores[j], scores[i]);
                }
            }
        }

        return (ranked, scores);
    }

    function getAgentRank(address agent, address[] calldata _agents) external view returns (uint256 rank, uint256 score) {
        score = getCreditScore(agent);
        rank = 1;

        for (uint256 i = 0; i < _agents.length; i++) {
            if (_agents[i] != agent && getCreditScore(_agents[i]) > score) {
                rank++;
            }
        }
    }

    function _calculateScore(
        address agent,
        Reputation storage rep
    ) internal view returns (uint256) {
        uint256 total = rep.totalJobsCompleted + rep.totalJobsDisputed;

        uint256 completionRate;
        if (total > 0) {
            completionRate = (rep.totalJobsCompleted * 1000) / total;
        }

        uint256 ratingScore;
        if (rep.averageRating > 0) {
            ratingScore = (rep.averageRating * 1000) / RATING_SCALE;
        }

        uint256 volumeScore;
        if (rep.totalValueCompleted > 0) {
            volumeScore = rep.totalValueCompleted > MAX_VOLUME
                ? 1000
                : (rep.totalValueCompleted * 1000) / MAX_VOLUME;
        }

        uint256 agentStake = stakeVault.getStake(agent);
        uint256 stakeScore;
        if (agentStake > 0) {
            stakeScore = agentStake > MAX_STAKE
                ? 1000
                : (agentStake * 1000) / MAX_STAKE;
        }

        uint256 recencyFactor = _recencyDecay(rep.lastUpdatedAt);

        uint256 score = (
            completionRate * COMPLETION_WEIGHT +
            ratingScore * RATING_WEIGHT +
            volumeScore * VOLUME_WEIGHT +
            stakeScore * STAKE_WEIGHT
        ) / 1000;

        score = (score * recencyFactor) / 1000;

        return score > MAX_SCORE ? MAX_SCORE : score;
    }

    function _recencyDecay(uint256 lastUpdated) internal view returns (uint256) {
        if (lastUpdated == 0) return 0;
        uint256 elapsed = block.timestamp - lastUpdated;
        if (elapsed >= DECAY_PERIOD * 2) return 500; // 50% minimum after 60 days
        if (elapsed >= DECAY_PERIOD) {
            return 1000 - ((elapsed - DECAY_PERIOD) * 500) / DECAY_PERIOD;
        }
        return 1000; // Full weight within DECAY_PERIOD
    }

    function setStakeVault(address _stakeVault) external {
        if (msg.sender != admin) revert NotAuthorized();
        stakeVault = IStakeVault(_stakeVault);
    }

    function setAdmin(address _admin) external {
        if (msg.sender != admin) revert NotAuthorized();
        admin = _admin;
    }
}
