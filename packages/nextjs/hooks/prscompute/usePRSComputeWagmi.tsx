"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { getEncryptionMethod, toHex, useFHEDecrypt, useFHEEncryption, useInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";

export type PRSState = {
  individualInput: string;
  individualIdHash?: string;
  snps: number[]; // length NUM_SNPS (20)
};

export const NUM_SNPS = 20; // Must match contract's NUM_SNPS

export const usePRSComputeWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  // Wagmi + ethers interop
  const { chainId, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Resolve deployed contract info once we know the chain
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: prsContract } = useDeployedContractInfo({ contractName: "PRSCompute" as any, chainId: allowedChainId });

  type PRSInfo = Contract<"PRSCompute" & string> & { chainId?: number };

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(prsContract?.address && prsContract?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(prsContract!.address, (prsContract as PRSInfo).abi, providerOrSigner);
  };

  // Local UI state managed outside by component; but provide helpers
  const [individualInput, setIndividualInput] = useState<string>("");
  const individualIdHash = useMemo(() => {
    if (!individualInput) return undefined;
    try {
      return ethers.keccak256(ethers.toUtf8Bytes(individualInput));
    } catch (e) {
      return undefined;
    }
  }, [individualInput]);

  const [snps, setSnps] = useState<number[]>(Array(NUM_SNPS).fill(0));

  const onSetSnp = useCallback((idx: number, val: number) => {
    setSnps(prev => prev.map((v, i) => (i === idx ? Math.max(0, Math.min(2, Math.floor(val))) : v)));
  }, []);

  const reset = useCallback(() => {
    setMessage("");
    setSnps(Array(NUM_SNPS).fill(0));
  }, []);

  // Reads
  const isRiskComputedRead = useReadContract({
    address: (hasContract ? (prsContract!.address as unknown as `0x${string}`) : undefined) as any,
    abi: (hasContract ? ((prsContract as PRSInfo).abi as any) : undefined) as any,
    functionName: "isRiskComputed" as const,
    args: individualIdHash ? [individualIdHash as `0x${string}`] : undefined,
    query: { enabled: Boolean(hasContract && hasProvider && individualIdHash) },
  });

  const riskHandleRead = useReadContract({
    address: (hasContract ? (prsContract!.address as unknown as `0x${string}`) : undefined) as any,
    abi: (hasContract ? ((prsContract as PRSInfo).abi as any) : undefined) as any,
    functionName: "getRiskResult" as const,
    args: individualIdHash ? [individualIdHash as `0x${string}`] : undefined,
    query: { enabled: Boolean(hasContract && hasProvider && individualIdHash && isRiskComputedRead.data === true) },
  });

  const riskHandle = useMemo(() => (riskHandleRead.data as string | undefined) ?? undefined, [riskHandleRead.data]);

  // Decrypt risk result (ebool)
  const requests = useMemo(() => {
    if (!hasContract || !riskHandle || riskHandle === ethers.ZeroHash) return undefined;
    return [{ handle: riskHandle, contractAddress: prsContract!.address } as const];
  }, [hasContract, prsContract?.address, riskHandle]);

  const { canDecrypt, decrypt, isDecrypting, message: decMsg, results } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const decryptedRisk = useMemo(() => {
    if (!riskHandle) return undefined as undefined | boolean;
    const clear = results[riskHandle];
    if (typeof clear === "undefined") return undefined;
    try {
      const n = typeof clear === "bigint" ? clear : BigInt(clear as any);
      return n !== 0n;
    } catch {
      return undefined;
    }
  }, [results, riskHandle]);

  // Encrypt + upload
  const { encryptWith } = useFHEEncryption({ instance, ethersSigner: ethersSigner as any, contractAddress: prsContract?.address });

  const canUpload = useMemo(() => Boolean(hasContract && instance && hasSigner && individualIdHash && snps.length === NUM_SNPS && !isProcessing), [hasContract, instance, hasSigner, individualIdHash, snps, isProcessing]);
  const canCompute = useMemo(() => Boolean(hasContract && hasSigner && individualIdHash && !isProcessing), [hasContract, hasSigner, individualIdHash, isProcessing]);

  const uploadEncryptedGenotype = useCallback(async () => {
    if (!canUpload) return;
    setIsProcessing(true);
    setMessage("Encrypting and uploading genotype...");
    try {
      const writeContract = getContract("write");
      if (!writeContract) throw new Error("Contract or signer not available");

      // Determine which builder method to use for externalEuint32
      const method = getEncryptionMethod("externalEuint32");

      // Encrypt all SNPs in a single batch - they share ONE inputProof
      const enc = await encryptWith(builder => {
        for (const v of snps) {
          (builder as any)[method](v);
        }
      });
      if (!enc) throw new Error("Encryption failed");
      if (!enc.handles?.length || enc.handles.length !== NUM_SNPS) {
        throw new Error(`Expected ${NUM_SNPS} handles, got ${enc.handles?.length ?? 0}`);
      }

      // Convert all handles to hex format
      const hexHandles = enc.handles.map(h => toHex(h));
      const inputProof = toHex(enc.inputProof);

      console.log("Uploading genotype with", hexHandles.length, "SNP handles");
      console.log("individualIdHash:", individualIdHash);

      // Call contract with individualId, array of encrypted SNPs, and single proof
      const tx = await (writeContract as any).uploadEncryptedGenotype(
        individualIdHash,
        hexHandles,
        inputProof
      );
      setMessage("Waiting for upload transaction...");
      await tx.wait();
      setMessage("Genotype uploaded successfully");
    } catch (e) {
      setMessage(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [canUpload, encryptWith, individualIdHash, snps, getContract]);

  const computePRS = useCallback(async () => {
    if (!canCompute) return;
    setIsProcessing(true);
    setMessage("Computing encrypted PRS on-chain...");
    try {
      const writeContract = getContract("write");
      if (!writeContract) throw new Error("Contract or signer not available");
      const tx = await (writeContract as any).computePRS(individualIdHash);
      await tx.wait();
      setMessage("PRS computed. You can now decrypt the risk result.");
      // Refetch to update isRiskComputed and enable decrypt button
      await isRiskComputedRead.refetch();
    } catch (e) {
      setMessage(`Compute failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [canCompute, getContract, individualIdHash, isRiskComputedRead]);

  const decryptRiskHandle = decrypt;

  return {
    // contract
    contractAddress: prsContract?.address as string | undefined,
    hasContract,

    // state
    message,
    isProcessing,

    individualInput,
    setIndividualInput,
    individualIdHash,

    snps,
    setSnps,
    onSetSnp,
    reset,

    // reads
    isRiskComputed: isRiskComputedRead.data === true,
    refreshIsRiskComputed: isRiskComputedRead.refetch,
    isRiskComputedLoading: isRiskComputedRead.isLoading || isRiskComputedRead.isFetching,
    refreshRiskHandle: riskHandleRead.refetch,
    isRiskHandleLoading: riskHandleRead.isLoading || riskHandleRead.isFetching,
    riskHandleRaw: riskHandleRead.data as bigint | undefined,

    // decrypt
    riskHandle,
    canDecrypt,
    decryptRiskHandle,
    isDecrypting,
    decryptedRisk,

    // actions
    canUpload,
    canCompute,
    uploadEncryptedGenotype,
    computePRS,
  };
};
