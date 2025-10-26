"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { FhevmInstance } from "../../fhevmTypes";
import { ethers } from "ethers";
import { GenericStringStorage } from "../../storage/GenericStringStorage";
import { FhevmDecryptionSignature } from "../../FhevmDecryptionSignature";
import { userDecryptWithSignature } from "../../core/decryption";

type Request = { handle: string; contractAddress: `0x${string}` };

type Props = {
  instance: FhevmInstance | undefined;
  signer: ethers.JsonRpcSigner | undefined;
  storage: GenericStringStorage;
  requests: readonly Request[] | undefined;
  onResults?: (r: Record<string, string | bigint | boolean>) => void;
  render?: (opts: { disabled: boolean; onClick: () => void; isDecrypting: boolean; message: string; error: string | null }) => React.ReactElement;
};

export const FHEDecryptButton: React.FC<Props> = ({ instance, signer, storage, requests, onResults, render }) => {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => Boolean(instance && signer && requests && requests.length > 0), [instance, signer, requests]);

  const onClick = useCallback(async () => {
    if (!instance || !signer || !requests || requests.length === 0) return;
    setIsDecrypting(true);
    setMessage("Start decrypt");
    setError(null);
    try {
      const uniqueAddresses = Array.from(new Set(requests.map(r => r.contractAddress)));
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, uniqueAddresses, signer, storage);
      if (!sig) {
        setMessage("Unable to build FHEVM decryption signature");
        setError("SIGNATURE_ERROR: Failed to create decryption signature");
        return;
      }
      setMessage("Call FHEVM userDecrypt...");
      const res = await userDecryptWithSignature(instance, requests, {
        privateKey: sig.privateKey,
        publicKey: sig.publicKey,
        signature: sig.signature,
        contractAddresses: sig.contractAddresses,
        userAddress: sig.userAddress,
        startTimestamp: sig.startTimestamp,
        durationDays: sig.durationDays,
      });
      onResults?.(res);
      setMessage("FHEVM userDecrypt completed!");
    } catch (e) {
      const err = e as unknown as { name?: string; message?: string };
      const code = err && typeof err === "object" && "name" in (err as any) ? (err as any).name : "DECRYPT_ERROR";
      const msg = err && typeof err === "object" && "message" in (err as any) ? (err as any).message : "Decryption failed";
      setError(`${code}: ${msg}`);
      setMessage("FHEVM userDecrypt failed");
    } finally {
      setIsDecrypting(false);
    }
  }, [instance, signer, requests, storage, onResults]);

  if (render) return render({ disabled: !canRun || isDecrypting, onClick, isDecrypting, message, error });
  return (
    <button disabled={!canRun || isDecrypting} onClick={onClick} title={message}>
      {isDecrypting ? "Decrypting..." : "Decrypt"}
    </button>
  );
};


