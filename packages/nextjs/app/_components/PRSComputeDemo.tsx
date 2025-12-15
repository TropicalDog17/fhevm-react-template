"use client";

import { useMemo, useRef, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { usePRSComputeWagmi, NUM_SNPS } from "~~/hooks/prscompute/usePRSComputeWagmi";

export const PRSComputeDemo = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;

  // FHEVM instance (reuse pattern from Counter demo)
  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);
  const initialMockChains = { 31337: "http://localhost:8545" };
  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const prs = usePRSComputeWagmi({ instance: fhevmInstance, initialMockChains });

  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buttonBase =
    "inline-flex items-center justify-center px-5 py-3 font-semibold shadow transition-all disabled:opacity-50 disabled:pointer-events-none";
  const primary = `${buttonBase} bg-[#FFD208] text-black hover:bg-[#A38025]`;
  const secondary = `${buttonBase} bg-black text-white hover:bg-[#1F1F1F]`;
  const success = `${buttonBase} bg-[#A38025] text-black`;
  const quickFillBtn = "px-3 py-2 text-sm font-medium border shadow-sm transition-all hover:shadow";
  const section = "bg-[#f4f4f4] shadow p-6 text-gray-900";
  const title = "font-bold text-gray-900 text-xl mb-3";

  const fillLowRisk = () => {
    for (let i = 0; i < NUM_SNPS; i++) {
      prs.onSetSnp(i, 0);
    }
  };

  const fillHighRisk = () => {
    for (let i = 0; i < NUM_SNPS; i++) {
      prs.onSetSnp(i, 2);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-gray-900">
        <div className="flex items-center justify-center">
          <div className="bg-white border shadow-xl p-8 text-center">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 text-amber-400 text-3xl">🔒</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Connect your wallet</h2>
            <p className="text-gray-700 mb-6">Connect to interact with the PRSCompute demo.</p>
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  const onFileSelected = async (file?: File | null) => {
    setFileError("");
    if (!file) return;
    try {
      const text = await file.text();
      // try JSON first
      let arr: number[] | null = null;
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) arr = parsed.map((v: any) => Number(v));
      } catch {}
      if (!arr) {
        // try CSV
        const cleaned = text.replace(/\n|\r/g, ",");
        const parts = cleaned.split(",").map(s => s.trim()).filter(Boolean);
        arr = parts.map(p => Number(p));
      }
      if (!arr || arr.length !== NUM_SNPS || arr.some(n => !Number.isFinite(n))) {
        throw new Error(`Expected exactly ${NUM_SNPS} numeric entries`);
      }
      for (let i = 0; i < NUM_SNPS; i++) {
        const v = Math.max(0, Math.min(2, Math.floor(arr[i]!)));
        prs.onSetSnp(i, v);
      }
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-900">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold">PRSCompute Demo</h1>
        <p className="text-gray-600">Privacy-preserving Polygenic Risk Score using FHE</p>
      </div>

      <div className={section}>
        <h3 className={title}>Connection</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {printRow("FHEVM", fhevmInstance ? "Connected" : "Not ready")}
          {printRow("FHEVM Status", fhevmStatus)}
          {printRow("Contract", prs.hasContract ? prs.contractAddress ?? "Found" : "Not found")}
        </div>
        {fhevmError && <p className="text-red-600 mt-2">{String(fhevmError)}</p>}
      </div>

      <div className={section}>
        <h3 className={title}>1) Enter Individual ID</h3>
        <div className="flex gap-3 items-center">
          <input
            className="w-full bg-white border border-gray-300 px-3 py-2 text-gray-900"
            placeholder="e.g. alice@example.com (hashed on-chain)"
            value={prs.individualInput}
            onChange={e => prs.setIndividualInput(e.target.value)}
          />
          <span className="text-xs text-gray-600">Hash: {prs.individualIdHash?.slice(0, 10)}...</span>
        </div>
      </div>

      <div className={section}>
        <h3 className={title}>2) Provide 20 SNP genotypes (0, 1, or 2)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {prs.snps.map((v, i) => (
            <div key={i} className="flex flex-col">
              <label className="text-xs text-gray-700 mb-1">SNP {i + 1}</label>
              <input
                type="number"
                min={0}
                max={2}
                value={v}
                onChange={e => prs.onSetSnp(i, Number(e.target.value))}
                className="bg-white border border-gray-300 px-2 py-1 text-gray-900"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Quick fill:</span>
          <button
            type="button"
            className={`${quickFillBtn} bg-green-100 border-green-300 text-green-800 hover:bg-green-200`}
            onClick={fillLowRisk}
          >
            Low Risk (all 0s)
          </button>
          <button
            type="button"
            className={`${quickFillBtn} bg-red-100 border-red-300 text-red-800 hover:bg-red-200`}
            onClick={fillHighRisk}
          >
            High Risk (all 2s)
          </button>
          <span className="text-gray-400">|</span>
          <input ref={fileInputRef} type="file" accept=".json,.csv,.txt" onChange={e => onFileSelected(e.target.files?.[0])} />
          {fileError && <span className="text-red-600 text-sm">{fileError}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className={prs.isProcessing ? secondary : primary} disabled={!prs.canUpload} onClick={prs.uploadEncryptedGenotype}>
          {prs.isProcessing ? "⏳ Uploading..." : "🔐 Encrypt + Upload Genotype"}
        </button>
        <button className={secondary} disabled={!prs.canCompute} onClick={prs.computePRS}>
          {prs.isProcessing ? "⏳ Computing..." : "🧮 Compute PRS"}
        </button>
        <button className={prs.decryptedRisk !== undefined ? success : primary} disabled={!prs.canDecrypt} onClick={prs.decryptRiskHandle}>
          {prs.decryptedRisk === undefined ? "🔓 Decrypt Risk" : prs.decryptedRisk ? "✅ High Risk" : "✅ Low Risk"}
        </button>
      </div>

      <div className={section}>
        <h3 className={title}>Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            {printRow("Risk Computed", prs.isRiskComputed)}
            <button
              type="button"
              className={`${quickFillBtn} bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200`}
              onClick={() => prs.refreshIsRiskComputed()}
              disabled={prs.isRiskComputedLoading}
            >
              {prs.isRiskComputedLoading ? "..." : "Refresh"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {printRow("Risk Handle (on-chain)", prs.riskHandleRaw !== undefined ? `0x${prs.riskHandleRaw.toString(16).slice(0, 12)}...` : "-")}
            <button
              type="button"
              className={`${quickFillBtn} bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200`}
              onClick={() => prs.refreshRiskHandle()}
              disabled={prs.isRiskHandleLoading || !prs.isRiskComputed}
            >
              {prs.isRiskHandleLoading ? "..." : "Refresh"}
            </button>
          </div>
          {printRow("Decrypted Risk", prs.decryptedRisk === undefined ? "-" : prs.decryptedRisk ? "High" : "Low")}
        </div>
        {prs.message && <p className="mt-3 bg-white border border-gray-300 p-3 text-gray-800">{prs.message}</p>}
      </div>
    </div>
  );
};

function printRow(label: string, value: any) {
  const text = typeof value === "boolean" ? (value ? "✓ true" : "✗ false") : String(value);
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
      <span className="text-gray-800 font-medium">{label}</span>
      <span className="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">{text}</span>
    </div>
  );
}

