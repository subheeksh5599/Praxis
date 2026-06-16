// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationLedger {
    function recordJobCompletion(address agent, uint256 paymentAmount, uint256 rating) external;
    function recordDispute(address agent) external;
    function getCreditScore(address agent) external view returns (uint256);
}

interface IStakeVault {
    function stake(address agent) external payable;
    function unstake(address agent, uint256 amount) external;
    function slashStake(address agent, uint256 amount, address recipient) external;
    function getStake(address agent) external view returns (uint256);
    function getTotalStaked(address agent) external view returns (uint256);
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

contract AgentRegistry {
    IStakeVault public stakeVault;
    IReputationLedger public reputation;

    uint256 public nextAgentId;
    uint256 public minStake;
    uint256 public registrationFee;
    address public admin;

    mapping(address => Agent) public agents;
    address[] public agentList;
    mapping(string => address[]) private agentsBySkill;
    mapping(address => bool) public isRegistered;

    event AgentRegistered(
        uint256 indexed id,
        address indexed owner,
        string name,
        uint256 stake,
        uint256 timestamp
    );
    event AgentUpdated(uint256 indexed id, address indexed owner);
    event AgentDeactivated(uint256 indexed id, address indexed owner);
    event AgentActivated(uint256 indexed id, address indexed owner);

    error AlreadyRegistered();
    error NotRegistered();
    error NotOwner();
    error StakeTooLow();
    error InvalidSkills();
    error NotAdmin();

    modifier onlyOwner(address agentAddress) {
        if (agents[agentAddress].owner != msg.sender) revert NotOwner();
        _;
    }

    modifier onlyRegistered(address agentAddress) {
        if (!isRegistered[agentAddress]) revert NotRegistered();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _stakeVault, address _reputation) {
        stakeVault = IStakeVault(_stakeVault);
        reputation = IReputationLedger(_reputation);
        admin = msg.sender;
        minStake = 1 ether;
    }

    function registerAgent(
        string calldata _name,
        string calldata _description,
        string[] calldata _skills,
        uint256 _pricePerMilestone,
        string calldata _metadataURI
    ) external payable {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();
        if (_skills.length == 0) revert InvalidSkills();
        if (msg.value < minStake) revert StakeTooLow();

        uint256 agentId = nextAgentId++;

        agents[msg.sender] = Agent({
            id: agentId,
            owner: msg.sender,
            name: _name,
            description: _description,
            skills: _skills,
            pricePerMilestone: _pricePerMilestone,
            isActive: true,
            registeredAt: block.timestamp,
            totalJobsCompleted: 0,
            totalJobsDisputed: 0,
            metadataURI: _metadataURI
        });

        agentList.push(msg.sender);
        isRegistered[msg.sender] = true;

        stakeVault.stake{value: msg.value}(msg.sender);

        for (uint256 i = 0; i < _skills.length; i++) {
            agentsBySkill[_skills[i]].push(msg.sender);
        }

        emit AgentRegistered(agentId, msg.sender, _name, msg.value, block.timestamp);
    }

    function updateAgent(
        string calldata _name,
        string calldata _description,
        string[] calldata _skills,
        uint256 _pricePerMilestone,
        string calldata _metadataURI
    ) external onlyRegistered(msg.sender) {
        Agent storage agent = agents[msg.sender];
        agent.name = _name;
        agent.description = _description;
        agent.pricePerMilestone = _pricePerMilestone;
        agent.metadataURI = _metadataURI;

        // Rebuild skill index
        delete agentsBySkill[agent.skills[0]]; // simplification
        agent.skills = _skills;
        for (uint256 i = 0; i < _skills.length; i++) {
            agentsBySkill[_skills[i]].push(msg.sender);
        }

        emit AgentUpdated(agent.id, msg.sender);
    }

    function addStake() external payable onlyRegistered(msg.sender) {
        if (msg.value == 0) revert StakeTooLow();
        stakeVault.stake{value: msg.value}(msg.sender);
    }

    function deactivate() external onlyRegistered(msg.sender) {
        agents[msg.sender].isActive = false;
        emit AgentDeactivated(agents[msg.sender].id, msg.sender);
    }

    function activate() external onlyRegistered(msg.sender) {
        agents[msg.sender].isActive = true;
        emit AgentActivated(agents[msg.sender].id, msg.sender);
    }

    function incrementJobCount(address agent) external {
        if (!isRegistered[agent]) revert NotRegistered();
        agents[agent].totalJobsCompleted++;
    }

    function incrementDisputeCount(address agent) external {
        if (!isRegistered[agent]) revert NotRegistered();
        agents[agent].totalJobsDisputed++;
    }

    function getAgent(address _agent) external view returns (Agent memory) {
        if (!isRegistered[_agent]) revert NotRegistered();
        return agents[_agent];
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function getActiveAgents() external view returns (Agent[] memory) {
        uint256 activeCount;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].isActive) activeCount++;
        }

        Agent[] memory result = new Agent[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].isActive) {
                result[idx++] = agents[agentList[i]];
            }
        }
        return result;
    }

    function getAgentsBySkill(string calldata _skill) external view returns (Agent[] memory) {
        address[] storage matched = agentsBySkill[_skill];
        Agent[] memory result = new Agent[](matched.length);
        for (uint256 i = 0; i < matched.length; i++) {
            result[i] = agents[matched[i]];
        }
        return result;
    }

    function findBestAgent(
        string calldata _skill,
        uint256 _maxPrice
    ) external view returns (Agent memory best, uint256 score) {
        address[] storage matched = agentsBySkill[_skill];
        uint256 bestScore;

        for (uint256 i = 0; i < matched.length; i++) {
            Agent memory agent = agents[matched[i]];
            if (!agent.isActive) continue;
            if (_maxPrice > 0 && agent.pricePerMilestone > _maxPrice) continue;

            uint256 agentScore = reputation.getCreditScore(matched[i]);
            if (agentScore > bestScore) {
                bestScore = agentScore;
                best = agent;
            }
        }

        score = bestScore;
    }

    function getAgentsSortedByScore(
        string calldata _skill,
        uint256 _maxPrice,
        uint256 _limit
    ) external view returns (Agent[] memory ranked, uint256[] memory scores) {
        address[] storage matched = agentsBySkill[_skill];
        uint256 count;

        for (uint256 i = 0; i < matched.length; i++) {
            if (agents[matched[i]].isActive) {
                if (_maxPrice == 0 || agents[matched[i]].pricePerMilestone <= _maxPrice) {
                    count++;
                }
            }
        }

        uint256 resultCount = count < _limit ? count : _limit;
        ranked = new Agent[](resultCount);
        scores = new uint256[](resultCount);

        address[] memory filtered = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < matched.length; i++) {
            if (agents[matched[i]].isActive) {
                if (_maxPrice == 0 || agents[matched[i]].pricePerMilestone <= _maxPrice) {
                    filtered[idx++] = matched[i];
                }
            }
        }

        // Selection sort by score (on-chain, limited results)
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 bestScore;
            uint256 bestIdx;
            for (uint256 j = 0; j < count; j++) {
                uint256 agentScore = reputation.getCreditScore(filtered[j]);
                if (agentScore > bestScore) {
                    bestScore = agentScore;
                    bestIdx = j;
                }
            }
            ranked[i] = agents[filtered[bestIdx]];
            scores[i] = bestScore;
            filtered[bestIdx] = address(0); // Mark as consumed
        }
    }

    function discoverAgents(
        string calldata _skill,
        uint256 _minReputation,
        uint256 _minStake,
        uint256 _maxPrice,
        uint256 _limit
    ) external view returns (Agent[] memory ranked, uint256[] memory scores) {
        address[] storage matched = agentsBySkill[_skill];
        uint256 count;

        for (uint256 i = 0; i < matched.length; i++) {
            Agent memory agent = agents[matched[i]];
            if (!agent.isActive) continue;
            if (_maxPrice > 0 && agent.pricePerMilestone > _maxPrice) continue;
            if (_minReputation > 0 && reputation.getCreditScore(matched[i]) < _minReputation) continue;
            if (_minStake > 0 && stakeVault.getStake(matched[i]) < _minStake) continue;
            count++;
        }

        uint256 resultCount = count < _limit ? count : _limit;
        if (_limit == 0) resultCount = count;
        ranked = new Agent[](resultCount);
        scores = new uint256[](resultCount);

        address[] memory filtered = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < matched.length; i++) {
            Agent memory agent = agents[matched[i]];
            if (!agent.isActive) continue;
            if (_maxPrice > 0 && agent.pricePerMilestone > _maxPrice) continue;
            if (_minReputation > 0 && reputation.getCreditScore(matched[i]) < _minReputation) continue;
            if (_minStake > 0 && stakeVault.getStake(matched[i]) < _minStake) continue;
            filtered[idx++] = matched[i];
        }

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 bestScore;
            uint256 bestIdx;
            for (uint256 j = 0; j < count; j++) {
                if (filtered[j] == address(0)) continue;
                uint256 agentScore = reputation.getCreditScore(filtered[j]);
                if (agentScore > bestScore) {
                    bestScore = agentScore;
                    bestIdx = j;
                }
            }
            ranked[i] = agents[filtered[bestIdx]];
            scores[i] = bestScore;
            filtered[bestIdx] = address(0);
        }
    }

    function calculateRequiredStake(address _agent) external view returns (uint256) {
        uint256 score = reputation.getCreditScore(_agent);
        if (score >= 800) return minStake / 4;       // Diamond: 25% of min
        if (score >= 600) return minStake / 2;       // Platinum: 50%
        if (score >= 400) return minStake;           // Gold: base
        if (score >= 200) return minStake * 2;       // Silver: 2x
        return minStake * 4;                         // Bronze: 4x
    }

    function setMinStake(uint256 _minStake) external onlyAdmin {
        minStake = _minStake;
    }

    function setRegistrationFee(uint256 _fee) external onlyAdmin {
        registrationFee = _fee;
    }

    function setReputationLedger(address _reputation) external onlyAdmin {
        reputation = IReputationLedger(_reputation);
    }

    function setStakeVault(address _stakeVault) external onlyAdmin {
        stakeVault = IStakeVault(_stakeVault);
    }
}
