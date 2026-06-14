// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {StakeVault} from "../assets/praxis/StakeVault.sol";
import {ReputationLedger} from "../assets/praxis/ReputationLedger.sol";
import {AgentRegistry} from "../assets/praxis/AgentRegistry.sol";
import {SlashingEngine} from "../assets/praxis/SlashingEngine.sol";
import {JobFactory} from "../assets/praxis/JobFactory.sol";
import {JobContract, MilestoneInput} from "../assets/praxis/JobContract.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        StakeVault stakeVault = new StakeVault();
        console.log("StakeVault:", address(stakeVault));

        ReputationLedger reputation = new ReputationLedger(address(stakeVault));
        console.log("ReputationLedger:", address(reputation));

        AgentRegistry registry = new AgentRegistry(
            address(stakeVault),
            address(reputation)
        );
        console.log("AgentRegistry:", address(registry));

        SlashingEngine slashing = new SlashingEngine(
            address(stakeVault),
            address(reputation)
        );
        console.log("SlashingEngine:", address(slashing));

        stakeVault.setSlashingEngine(address(slashing));
        reputation.setAdmin(address(registry));

        JobFactory jobFactory = new JobFactory(
            address(registry),
            address(slashing),
            address(reputation)
        );
        console.log("JobFactory:", address(jobFactory));

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployer:", deployer);
        console.log("All 6 contracts deployed.");
    }
}
