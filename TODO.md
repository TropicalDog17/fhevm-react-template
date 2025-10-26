# Zama SDK

## Features

- [ ] Be framework-agnostic (usable in Node.js, Next.js, Vue, React, or any frontend setup).
- [ ] Serve as a wrapper around all required packages, so developers don’t need to worry about scattered dependencies.
- [ ] Provide a wagmi-like structure to make it intuitive for web3 developers.
- [ ] Enable quick setup for encryption and decryption flows while following Zama’s official SDKs and guidelines.

### Notes
‍Focus on the FHEVM SDK. The Next.js code should only serve as a showcase/example of how the SDK works, not as the main deliverable.
Help yourself with what's already written in: packages/fhevm-sdk.‍
Check out GitHub issues for inspiration and community feedback.
Your end result should showcase a complete setup that allows developers to:
Install all packages from root.
Compile, deploy, and generate an ABI from the Solidity contract.
Start the desired frontend template from root

### Build a universal SDK package (fhevm-sdk) that:

Can be imported into any dApp.
Provides utilities for initialization, encrypted inputs, and decryption flows (userDecrypt with EIP-712 signing + publicDecrypt).
Exposes a wagmi-like modular API structure (hooks/adapters for React, but keep the core independent).
Makes reusable components that cover different encryption/decryption scenarios.
Keep it clean, reusable, and extensible.

