// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
  FHE,
  ebool,
  euint32,
  euint64,
  externalEuint32,
  externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title PRSCompute
 * @notice Privacy-preserving Polygenic Risk Score computation using FHE
 * @dev Computes encrypted Polygenic Risk Score (PRS) and outputs an encrypted high/low risk classification.
 */
contract PRSCompute is SepoliaConfig {
  // Constants
  uint256 public constant NUM_SNPS = 20;
  uint32 public constant RISK_THRESHOLD = 50; // Threshold for high-risk classification

  // GWAS effect sizes (beta coefficients) - pre-loaded for MVP
  // In production, these would be stored securely and updated
  uint32[NUM_SNPS] public effectSizes = [
    3, 2, 4, 2, 3, 2, 3, 2, 4, 2,
    3, 2, 3, 2, 4, 2, 3, 2, 3, 2
  ];

  // Struct to store encrypted genotype data
  struct EncryptedGenotype {
    euint32[NUM_SNPS] snps;
    address owner;
    uint256 timestamp;
    bool riskComputed;
    // Demo clarity: store both the encrypted PRS and the encrypted classification
    euint32 prsScore; // Encrypted polygenic risk score (never revealed in plaintext)
    ebool isHighRisk; // Encrypted classification: true = high-risk, false = low-risk
  }

  // Mapping from individual ID to encrypted genotype
  mapping(bytes32 => EncryptedGenotype) public genotypeData;

  // Event logging
  event GenotypeUploaded(bytes32 indexed individualId, address indexed uploader, uint256 timestamp);
  // Kept for backward compatibility with any listeners
  event RiskComputed(bytes32 indexed individualId, address indexed requester, uint256 timestamp);
  // New, clearer event for demo messaging
  event PRSComputed(
    bytes32 indexed individualId,
    uint256 snpCount,
    uint32 threshold
  );
  event EffectSizeUpdated(uint256 indexed snpIndex, uint32 newValue);

  /**
   * @notice Upload encrypted genotype data for an individual
   * @param individualId Unique identifier for the individual
   * @param encryptedSnps Array of encrypted genotype values (0, 1, or 2 per SNP)
   * @param inputProof Single proof for all encrypted values (batch encryption)
   */
  function uploadEncryptedGenotype(
    bytes32 individualId,
    externalEuint32[] calldata encryptedSnps,
    bytes calldata inputProof
  ) external {
    require(encryptedSnps.length == NUM_SNPS, "Invalid number of SNPs");
    require(genotypeData[individualId].owner == address(0), "Individual already exists");

    // Create new genotype entry
    EncryptedGenotype storage genotype = genotypeData[individualId];
    genotype.owner = msg.sender;
    genotype.timestamp = block.timestamp;
    genotype.riskComputed = false;

    // Decrypt and store encrypted SNP values (all share the same inputProof)
    for (uint256 i = 0; i < NUM_SNPS; i++) {
      genotype.snps[i] = FHE.fromExternal(encryptedSnps[i], inputProof);
      FHE.allowThis(genotype.snps[i]);
      FHE.allow(genotype.snps[i], msg.sender);
    }

    emit GenotypeUploaded(individualId, msg.sender, block.timestamp);
  }

  /**
   * @notice Compute PRS using homomorphic operations
   * @dev Performs encrypted dot product: sum(beta_j * G_ij). We compute an encrypted PRS, but never reveal it — only whether it crosses a medical threshold.
   * @param individualId ID of individual to compute PRS for
   */
  function computePRS(bytes32 individualId) external {
    require(genotypeData[individualId].owner != address(0), "Individual not found");
    require(!genotypeData[individualId].riskComputed, "Risk already computed");

    EncryptedGenotype storage genotype = genotypeData[individualId];

    // Initialize accumulator for PRS (encrypted)
    euint32 encryptedPRS = FHE.asEuint32(0);

    // Compute weighted sum: PRS = sum(beta_j * G_ij)
    for (uint256 i = 0; i < NUM_SNPS; i++) {
      // Multiply genotype by effect size
      euint32 weighted = FHE.mul(genotype.snps[i], FHE.asEuint32(effectSizes[i]));

      // Add to running total
      encryptedPRS = FHE.add(encryptedPRS, weighted);
    }

    // Store the encrypted score (for demo/privacy messaging) and classify risk
    genotype.prsScore = encryptedPRS;
    genotype.isHighRisk = FHE.gt(encryptedPRS, FHE.asEuint32(RISK_THRESHOLD));
    genotype.riskComputed = true;

    // Grant permissions for decryption (encrypted outputs only)
    FHE.allowThis(genotype.isHighRisk);
    FHE.allow(genotype.isHighRisk, msg.sender);
    FHE.allow(genotype.isHighRisk, genotype.owner);

    FHE.allowThis(genotype.prsScore);
    FHE.allow(genotype.prsScore, msg.sender);
    FHE.allow(genotype.prsScore, genotype.owner);

    // Events for both backward compatibility and clearer demo naming
    emit RiskComputed(individualId, msg.sender, block.timestamp);
    emit PRSComputed(individualId, NUM_SNPS, RISK_THRESHOLD);
  }

  /**
   * @notice Retrieve encrypted high/low risk classification
   * @param individualId ID of individual
   * @return Encrypted boolean (true = high-risk, false = low-risk)
   */
  function getRiskResult(bytes32 individualId) external view returns (ebool) {
    require(genotypeData[individualId].owner != address(0), "Individual not found");
    require(genotypeData[individualId].riskComputed, "Risk not yet computed");
    return genotypeData[individualId].isHighRisk;
  }

  /**
   * @notice Retrieve the encrypted PRS value. The number itself is never revealed on-chain.
   * @param individualId ID of individual
   * @return Encrypted PRS (euint32)
   */
  function getEncryptedPRS(bytes32 individualId) external view returns (euint32) {
    require(genotypeData[individualId].owner != address(0), "Individual not found");
    require(genotypeData[individualId].riskComputed, "Risk not yet computed");
    return genotypeData[individualId].prsScore;
  }

  /**
   * @notice Check if risk has been computed for individual
   * @param individualId ID of individual
   * @return Boolean indicating if risk computation is complete
   */
  function isRiskComputed(bytes32 individualId) external view returns (bool) {
    return genotypeData[individualId].riskComputed;
  }

  /**
   * @notice Get genotype owner
   * @param individualId ID of individual
   * @return Address of the individual who uploaded the data
   */
  function getGenotypeOwner(bytes32 individualId) external view returns (address) {
    return genotypeData[individualId].owner;
  }

  /**
   * @notice Update effect size for a specific SNP (admin function)
   * @param snpIndex Index of SNP to update
   * @param newValue New effect size value
   */
  function updateEffectSize(uint256 snpIndex, uint32 newValue) external {
    require(snpIndex < NUM_SNPS, "Invalid SNP index");
    effectSizes[snpIndex] = newValue;
    emit EffectSizeUpdated(snpIndex, newValue);
  }

  /**
   * @notice Get all effect sizes
   * @return Array of effect sizes for all SNPs
   */
  function getEffectSizes() external view returns (uint32[NUM_SNPS] memory) {
    return effectSizes;
  }

  /**
   * @notice Get risk threshold
   * @return Current risk threshold value
   */
  function getRiskThreshold() external pure returns (uint32) {
    return RISK_THRESHOLD;
  }
}
