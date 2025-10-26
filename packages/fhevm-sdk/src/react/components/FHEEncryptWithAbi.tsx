"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { FhevmInstance } from "../../fhevmTypes";
import { ethers } from "ethers";
import { buildParamsFromAbi, createEncryptedInputAndEncrypt, getEncryptionMethod } from "../../core/encryption";

type Props = {
  instance: FhevmInstance | undefined;
  signer: ethers.JsonRpcSigner | undefined;
  contractAddress: `0x${string}` | undefined;
  abi: any[];
  fn: string;
  values: (number | string | boolean)[];
  onEncrypted?: (params: any[]) => void;
  render?: (opts: { disabled: boolean; onClick: () => void; isEncrypting: boolean }) => React.ReactElement;
};

export const FHEEncryptWithAbi: React.FC<Props> = ({ instance, signer, contractAddress, abi, fn, values, onEncrypted, render }) => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const canRun = useMemo(() => Boolean(instance && signer && contractAddress), [instance, signer, contractAddress]);

  const onClick = useCallback(async () => {
    if (!instance || !signer || !contractAddress) return;
    setIsEncrypting(true);
    try {
      const enc = await createEncryptedInputAndEncrypt(instance, signer, contractAddress, builder => {
        for (const v of values) {
          const type = typeof v;
          if (type === "boolean") builder.addBool(v as boolean);
          else if (type === "string") builder.add64(BigInt(v as string));
          else builder.add64(BigInt(v as number));
        }
      });
      const params = buildParamsFromAbi(enc, abi, fn);
      onEncrypted?.(params);
    } finally {
      setIsEncrypting(false);
    }
  }, [instance, signer, contractAddress, abi, fn, values, onEncrypted]);

  if (render) return render({ disabled: !canRun || isEncrypting, onClick, isEncrypting });
  return (
    <button disabled={!canRun || isEncrypting} onClick={onClick}>
      {isEncrypting ? "Encrypting..." : "Encrypt"}
    </button>
  );
};


