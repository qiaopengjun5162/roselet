import {
  BASE_FEE_LAMPORTS,
  MAX_PRIORITY_FEE_MICRO_LAMPORTS,
  MEMO_COMPUTE_UNIT_LIMIT,
  clusterLabel,
  clusterSpendsRealSol,
  clusterTone,
  detectCluster,
  estimatedFeeLamports,
  explorerTxUrl,
  parsePriorityFeeMicroLamports,
  priorityFeeLamports,
} from "../solana";

describe("solana cluster helpers", () => {
  it("detects devnet, mainnet and custom endpoints", () => {
    expect(detectCluster("https://api.devnet.solana.com")).toBe("devnet");
    expect(detectCluster("https://api.mainnet-beta.solana.com")).toBe("mainnet-beta");
    expect(detectCluster("https://rpc.helius.xyz/?api-key=abc")).toBe("custom");
  });

  it("is case-insensitive when detecting the cluster", () => {
    expect(detectCluster("HTTPS://API.DEVNET.SOLANA.COM")).toBe("devnet");
    expect(detectCluster("HTTPS://API.MAINNET-BETA.SOLANA.COM")).toBe("mainnet-beta");
  });

  it("labels clusters for the UI", () => {
    expect(clusterLabel("devnet")).toContain("Devnet");
    expect(clusterLabel("mainnet-beta")).toContain("主网");
    expect(clusterLabel("custom")).toContain("自定义");
  });

  it("flags real-SOL spending for non-devnet clusters", () => {
    expect(clusterSpendsRealSol("devnet")).toBe(false);
    expect(clusterSpendsRealSol("mainnet-beta")).toBe(true);
    // Unknown/custom endpoints are treated conservatively as real-money.
    expect(clusterSpendsRealSol("custom")).toBe(true);
  });

  it("returns distinct badge tones per cluster", () => {
    expect(clusterTone("devnet")).not.toBe(clusterTone("mainnet-beta"));
  });

  it("builds explorer urls with the right cluster suffix", () => {
    expect(explorerTxUrl("sig123", "devnet")).toBe(
      "https://explorer.solana.com/tx/sig123?cluster=devnet",
    );
    // Mainnet and custom endpoints keep the default cluster (no query param).
    expect(explorerTxUrl("sig123", "mainnet-beta")).toBe(
      "https://explorer.solana.com/tx/sig123",
    );
    expect(explorerTxUrl("sig123", "custom")).toBe(
      "https://explorer.solana.com/tx/sig123",
    );
  });
});

describe("solana fee helpers", () => {
  it("defaults to no priority fee when the env var is missing or bogus", () => {
    expect(parsePriorityFeeMicroLamports(undefined)).toBe(0);
    expect(parsePriorityFeeMicroLamports("")).toBe(0);
    expect(parsePriorityFeeMicroLamports("   ")).toBe(0);
    expect(parsePriorityFeeMicroLamports("abc")).toBe(0);
    expect(parsePriorityFeeMicroLamports("-5")).toBe(0);
    expect(parsePriorityFeeMicroLamports("0")).toBe(0);
  });

  it("parses a positive price and clamps it to the safety ceiling", () => {
    expect(parsePriorityFeeMicroLamports("50000")).toBe(50_000);
    expect(parsePriorityFeeMicroLamports("1500.9")).toBe(1_500);
    expect(parsePriorityFeeMicroLamports("999999999")).toBe(
      MAX_PRIORITY_FEE_MICRO_LAMPORTS,
    );
  });

  it("computes priority fee as price × CU limit ÷ 1e6", () => {
    // 50_000 microLamports/CU over 20_000 CU = 1_000 lamports.
    expect(priorityFeeLamports(50_000)).toBe(1_000);
    expect(priorityFeeLamports(0)).toBe(0);
    expect(priorityFeeLamports(-1)).toBe(0);
    // Rounds up so the displayed estimate is never lower than reality.
    expect(priorityFeeLamports(1, 1)).toBe(1);
  });

  it("adds the 5000-lamport base fee per signature", () => {
    expect(estimatedFeeLamports(0)).toBe(BASE_FEE_LAMPORTS);
    expect(estimatedFeeLamports(50_000)).toBe(BASE_FEE_LAMPORTS + 1_000);
    // A memo tx uses far less than the 200k default CU limit, so pinning the
    // limit is what keeps the priority fee sane.
    expect(MEMO_COMPUTE_UNIT_LIMIT).toBeLessThan(200_000);
  });
});
