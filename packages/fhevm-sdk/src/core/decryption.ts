import type { FhevmInstance } from "../fhevmTypes";

export type UserDecryptSignature = {
  privateKey: string;
  publicKey: string;
  signature: string;
  contractAddresses: `0x${string}`[];
  userAddress: `0x${string}`;
  startTimestamp: number;
  durationDays: number;
};

export type DecryptRequest = { handle: string; contractAddress: `0x${string}` };

export const userDecryptWithSignature = async (
  instance: FhevmInstance,
  requests: readonly DecryptRequest[],
  sig: UserDecryptSignature
): Promise<Record<string, string | bigint | boolean>> => {
  const mutableReqs = requests.map(r => ({ handle: r.handle, contractAddress: r.contractAddress }));
  return (instance as any).userDecrypt(
    mutableReqs,
    sig.privateKey,
    sig.publicKey,
    sig.signature,
    sig.contractAddresses,
    sig.userAddress,
    sig.startTimestamp,
    sig.durationDays,
  );
};

export const publicDecrypt = async (
  instance: FhevmInstance,
  requests: readonly DecryptRequest[]
): Promise<Record<string, string | bigint | boolean>> => {
  const mutableReqs = requests.map(r => ({ handle: r.handle, contractAddress: r.contractAddress }));
  return (instance as any).publicDecrypt(mutableReqs);
};


