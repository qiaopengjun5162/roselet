import {
  clusterLabel,
  clusterSpendsRealSol,
  clusterTone,
  detectCluster,
  explorerTxUrl,
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
