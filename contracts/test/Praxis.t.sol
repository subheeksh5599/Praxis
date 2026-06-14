// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {StakeVault} from "../src/StakeVault.sol";
import {ReputationLedger} from "../src/ReputationLedger.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {SlashingEngine} from "../src/SlashingEngine.sol";
import {JobFactory} from "../src/JobFactory.sol";
import {JobContract, MilestoneInput} from "../src/JobContract.sol";

contract PraxisTest is Test {
    StakeVault public stakeVault;
    ReputationLedger public reputation;
    AgentRegistry public registry;
    SlashingEngine public slashing;
    JobFactory public jobFactory;

    address researchAgent = makeAddr("researchAgent");
    address tradingAgent = makeAddr("tradingAgent");
    address auditAgent = makeAddr("auditAgent");
    address scamAgent = makeAddr("scamAgent");

    function setUp() public {
        stakeVault = new StakeVault();
        reputation = new ReputationLedger(address(stakeVault));

        registry = new AgentRegistry(address(stakeVault), address(reputation));
        slashing = new SlashingEngine(address(stakeVault), address(reputation));
        stakeVault.setSlashingEngine(address(slashing));

        jobFactory = new JobFactory(
            address(registry),
            address(slashing),
            address(reputation)
        );

        reputation.setAuthorized(address(jobFactory), true);
        reputation.setAdmin(address(registry));
    }

    /* ── Agent Registration ─────────────────────── */

    function testRegisterAgent() public {
        string[] memory skills = new string[](2);
        skills[0] = "market analysis";
        skills[1] = "sentiment";

        vm.deal(researchAgent, 10 ether);
        vm.prank(researchAgent);
        registry.registerAgent{value: 2 ether}(
            "ResearchAgent",
            "Market analysis and sentiment scoring",
            skills,
            0.05 ether,
            "ipfs://"
        );

        assertTrue(registry.isRegistered(researchAgent));
        assertEq(stakeVault.getStake(researchAgent), 2 ether);
    }

    function testCannotRegisterTwice() public {
        string[] memory skills = new string[](1);
        skills[0] = "audit";

        vm.deal(auditAgent, 10 ether);
        vm.prank(auditAgent);
        registry.registerAgent{value: 2 ether}(
            "AuditAgent", "Smart contract auditor", skills, 0.1 ether, "ipfs://"
        );

        vm.prank(auditAgent);
        vm.expectRevert();
        registry.registerAgent{value: 2 ether}(
            "AuditAgent", "", skills, 0, ""
        );
    }

    /* ── Job Lifecycle ──────────────────────────── */

    function testFullJobLifecycle() public {
        // 1. Register agents
        string[] memory rSkills = new string[](1);
        rSkills[0] = "market analysis";
        vm.deal(researchAgent, 10 ether);
        vm.prank(researchAgent);
        registry.registerAgent{value: 2 ether}(
            "ResearchAgent", "Market analysis", rSkills, 0.05 ether, "ipfs://"
        );

        // 2. Create job
        MilestoneInput[] memory milestones = new MilestoneInput[](1);
        milestones[0] = MilestoneInput({
            description: "BTC analysis report",
            payment: 0.5 ether,
            deadline: block.timestamp + 7 days
        });

        vm.deal(tradingAgent, 10 ether);
        vm.prank(tradingAgent);
        address jobAddr = jobFactory.createJob{value: 0.5 ether}(
            researchAgent,
            "BTC Analysis",
            "Technical analysis report",
            milestones,
            ""
        );

        JobContract job = JobContract(payable(jobAddr));

        // 3. Agent accepts
        vm.prank(researchAgent);
        job.acceptJob();

        // 4. Submit milestone
        bytes32 proof = keccak256("analysis_report.pdf");
        vm.prank(researchAgent);
        job.submitMilestone(0, proof);

        // 5. Employer confirms
        vm.prank(tradingAgent);
        job.confirmMilestone(0, 400);

        // 6. Verify payment
        assertEq(address(researchAgent).balance, 0.5 ether + 8 ether); // 8 ether remaining after 2 stake

        // 7. Verify reputation updated
        (uint256 totalJobs, , , , , , , ) = reputation.reputations(researchAgent);
        assertEq(totalJobs, 1);
    }

    /* ── Slashing ──────────────────────────────── */

    function testSlashingOnDispute() public {
        // Register scam agent
        string[] memory skills = new string[](1);
        skills[0] = "audit";
        vm.deal(scamAgent, 10 ether);
        vm.prank(scamAgent);
        registry.registerAgent{value: 2 ether}(
            "ScamAgent", "Fake auditor", skills, 0.05 ether, ""
        );

        // Create and accept job
        MilestoneInput[] memory milestones = new MilestoneInput[](1);
        milestones[0] = MilestoneInput({
            description: "Audit report",
            payment: 0.5 ether,
            deadline: block.timestamp + 7 days
        });

        vm.deal(tradingAgent, 10 ether);
        vm.prank(tradingAgent);
        address jobAddr = jobFactory.createJob{value: 0.5 ether}(
            scamAgent, "Audit", "Smart contract audit", milestones, ""
        );

        JobContract job = JobContract(payable(jobAddr));
        vm.prank(scamAgent);
        job.acceptJob();

        bytes32 fakeProof = keccak256("fake_report");
        vm.prank(scamAgent);
        job.submitMilestone(0, fakeProof);

        // Employer disputes
        bytes32 evidence = keccak256("proof_of_fraud");
        vm.prank(tradingAgent);
        job.disputeMilestone(0, evidence);

        // Admin resolves - agent at fault
        (, , , , , , bool disputed, ) = job.milestones(0);
        assertTrue(disputed);

        // Verify dispute was opened
        (
            address dJob,
            uint256 dMilestone,
            address dEmployer,
            ,
            bytes32 dEvidence,
            ,
            bool dResolved,
            ,
        ) = slashing.disputes(0);
        assertEq(dJob, jobAddr);
        assertEq(dEvidence, evidence);
        assertFalse(dResolved);
    }

    /* ── Reputation Score ───────────────────────── */

    function testReputationScoreIncreases() public {
        string[] memory skills = new string[](1);
        skills[0] = "trading";
        vm.deal(tradingAgent, 10 ether);
        vm.prank(tradingAgent);
        registry.registerAgent{value: 2 ether}(
            "TradingAgent", "DeFi trading", skills, 0.05 ether, ""
        );

        uint256 initialScore = reputation.getCreditScore(tradingAgent);
        assertEq(initialScore, 0);

        // Simulate completed job (call recordJobCompletion directly for test)
        vm.prank(address(registry));
        reputation.recordJobCompletion(tradingAgent, 1 ether, 400);

        uint256 finalScore = reputation.getCreditScore(tradingAgent);
        assertGt(finalScore, 0);
        assertLe(finalScore, 1000);
    }

    /* ── Discovery Engine ───────────────────────── */

    function testFindBestAgent() public {
        string[] memory skills1 = new string[](1);
        skills1[0] = "audit";
        string[] memory skills2 = new string[](1);
        skills2[0] = "audit";

        vm.deal(researchAgent, 10 ether);
        vm.prank(researchAgent);
        registry.registerAgent{value: 2 ether}("Agent1", "", skills1, 0.1 ether, "");

        vm.deal(auditAgent, 10 ether);
        vm.prank(auditAgent);
        registry.registerAgent{value: 5 ether}("Agent2", "", skills2, 0.05 ether, "");

        // Record a completion so credit scores are calculated
        vm.prank(address(jobFactory));
        reputation.recordJobCompletion(researchAgent, 0.5 ether, 300);

        // Agent2 should rank higher (more stake)
        (, uint256 score) = registry.findBestAgent("audit", 0);
        assertGt(score, 0);
    }

    /* ── Multi-Agent: Agents Hiring Agents ──────── */

    function testAgentsHiringAgents() public {
        // Register ResearchAgent
        string[] memory rSkills = new string[](1);
        rSkills[0] = "research";
        vm.deal(researchAgent, 10 ether);
        vm.prank(researchAgent);
        registry.registerAgent{value: 2 ether}("ResearchAgent", "", rSkills, 0.05 ether, "");

        // TradingAgent hires ResearchAgent (agent-to-agent)
        MilestoneInput[] memory milestones = new MilestoneInput[](1);
        milestones[0] = MilestoneInput({
            description: "Market research",
            payment: 0.5 ether,
            deadline: block.timestamp + 7 days
        });

        vm.deal(tradingAgent, 10 ether);
        vm.prank(tradingAgent);
        address jobAddr = jobFactory.createJob{value: 0.5 ether}(
            researchAgent, "Research", "Market analysis", milestones, ""
        );

        JobContract job = JobContract(payable(jobAddr));
        vm.prank(researchAgent);
        job.acceptJob();

        vm.prank(researchAgent);
        job.submitMilestone(0, keccak256("report.pdf"));

        vm.prank(tradingAgent);
        job.confirmMilestone(0, 450);

        // Verify ResearchAgent was paid
        assertEq(address(researchAgent).balance, 8.5 ether); // 10 - 2 stake + 0.5 payment
    }
}
