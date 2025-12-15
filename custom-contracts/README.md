# Custom Contracts

This directory contains custom contracts that are added to the `packages/hardhat` submodule.

Since `packages/hardhat` is a git submodule pointing to the upstream fhevm-hardhat-template repository, any custom contracts added directly to the submodule would be lost when the submodule is updated.

## Purpose

This directory serves as a backup and source of truth for custom contracts that should be:
1. Preserved across submodule updates
2. Automatically copied back to the submodule after updates
3. Included in the deployment scripts

## Custom Contracts

- **PRSCompute.sol**: Privacy-preserving Polygenic Risk Score computation using FHE

## Workflow

### After Updating the Submodule

When you need to update the `packages/hardhat` submodule to get the latest changes from upstream:

```bash
pnpm update-submodule
```

This script will:
1. Backup any existing custom contracts from the submodule to this directory
2. Update the submodule to the latest version from upstream
3. Copy the custom contracts back to the submodule
4. Update the deployment script to include custom contracts

### Manually Adding a New Custom Contract

If you add a new custom contract:

1. Add the contract file to this directory
2. Add the contract name to the `CUSTOM_CONTRACTS` array in `scripts/updateSubmodule.ts`
3. Run `pnpm update-submodule` to apply the changes

## Files in This Directory

- `PRSCompute.sol` - Custom FHE-based polygenic risk score computation contract
