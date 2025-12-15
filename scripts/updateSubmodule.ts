#!/usr/bin/env ts-node
/**
 * Post-submodule update script
 *
 * This script should be run after updating the packages/hardhat submodule.
 * It preserves custom contracts (like PRSCompute.sol) and updates the deployment script.
 *
 * Usage:
 *   pnpm update-submodule
 *
 * This will:
 * 1. Update the submodule to latest from upstream
 * 2. Copy custom contracts back to the submodule
 * 3. Update the deployment script to include custom contracts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Paths
const ROOT_DIR = path.resolve(__dirname, "..");
const SUBMODULE_DIR = path.join(ROOT_DIR, "packages/hardhat");
const CUSTOM_CONTRACTS_DIR = path.join(ROOT_DIR, "custom-contracts");
const DEPLOY_SCRIPT_PATH = path.join(SUBMODULE_DIR, "deploy/deploy.ts");

// Custom contracts to preserve
const CUSTOM_CONTRACTS = ["PRSCompute.sol"];

function ensureCustomContractsBackup() {
  console.log("📦 Ensuring custom contracts are backed up...");

  if (!fs.existsSync(CUSTOM_CONTRACTS_DIR)) {
    fs.mkdirSync(CUSTOM_CONTRACTS_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${CUSTOM_CONTRACTS_DIR}`);
  }

  // Backup custom contracts from submodule to custom-contracts directory
  for (const contractFile of CUSTOM_CONTRACTS) {
    const sourcePath = path.join(SUBMODULE_DIR, "contracts", contractFile);
    const backupPath = path.join(CUSTOM_CONTRACTS_DIR, contractFile);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`✅ Backed up ${contractFile} to custom-contracts/`);
    }
  }
}

function updateSubmodule() {
  console.log("\n🔄 Updating submodule...");

  try {
    execSync("git submodule update --remote packages/hardhat", {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
    console.log("✅ Submodule updated successfully");
  } catch (error) {
    console.error("❌ Failed to update submodule:", error);
    process.exit(1);
  }
}

function restoreCustomContracts() {
  console.log("\n📝 Restoring custom contracts...");

  for (const contractFile of CUSTOM_CONTRACTS) {
    const backupPath = path.join(CUSTOM_CONTRACTS_DIR, contractFile);
    const targetPath = path.join(SUBMODULE_DIR, "contracts", contractFile);

    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, targetPath);
      console.log(`✅ Restored ${contractFile} to submodule`);
    } else {
      console.warn(`⚠️  Backup not found for ${contractFile}`);
    }
  }
}

function updateDeployScript() {
  console.log("\n📄 Updating deploy script...");

  if (!fs.existsSync(DEPLOY_SCRIPT_PATH)) {
    console.error(`❌ Deploy script not found at ${DEPLOY_SCRIPT_PATH}`);
    return;
  }

  const deployContent = fs.readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  // Check if PRSCompute is already in the deploy script
  if (deployContent.includes("PRSCompute")) {
    console.log("✅ Deploy script already includes PRSCompute");
    return;
  }

  // Add PRSCompute deployment
  const updatedContent = deployContent.replace(
    /(\s+console\.log\(`FHECounter contract: `, deployedFHECounter\.address\);)/,
    `$1

  const deployedPRS = await deploy("PRSCompute", {
    from: deployer,
    log: true,
  });
  console.log(\`PRSCompute contract: \`, deployedPRS.address);`,
  );

  // Update tags
  const finalContent = updatedContent.replace(
    /func\.tags = \["FHECounter"\];?/,
    'func.tags = ["FHECounter", "PRSCompute"];',
  );

  fs.writeFileSync(DEPLOY_SCRIPT_PATH, finalContent);
  console.log("✅ Deploy script updated with PRSCompute");
}

async function main() {
  console.log("🚀 Starting submodule update process...\n");

  // Step 1: Ensure custom contracts are backed up
  ensureCustomContractsBackup();

  // Step 2: Update the submodule
  updateSubmodule();

  // Step 3: Restore custom contracts
  restoreCustomContracts();

  // Step 4: Update deploy script
  updateDeployScript();

  console.log("\n✨ Submodule update complete!");
  console.log("\n📌 Next steps:");
  console.log("  1. Run: pnpm compile");
  console.log("  2. Run: pnpm deploy:localhost (or deploy:sepolia)");
  console.log("  3. Run: pnpm generate");
}

main().catch(error => {
  console.error("❌ Error:", error);
  process.exit(1);
});
