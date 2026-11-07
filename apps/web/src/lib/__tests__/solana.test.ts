import {
  BASE_FEE_LAMPORTS,
  MAX_PRIORITY_FEE_MICRO_LAMPORTS,
  MEMO_COMPUTE_UNIT_LIMIT,
  NFT_FIELD_VALUE_MAX_BYTES,
  NFT_NAME_MAX_BYTES,
  NFT_URI_MAX_BYTES,
  ROSE_NFT_SYMBOL,
  buildRoseNftFields,
  clusterLabel,
  clusterSpendsRealSol,
  clusterTone,
  detectCluster,
  estimatedFeeLamports,
  explorerAccountUrl,
  explorerTxUrl,
  lamportsToSol,
  parsePriorityFeeMicroLamports,
  priorityFeeLamports,
  truncateUtf8,
  utf8ByteLength,
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

describe("solana explorer account links", () => {
  it("appends the devnet cluster and omits it on mainnet", () => {
    expect(explorerAccountUrl("Mint111", "devnet")).toBe(
      "https://explorer.solana.com/address/Mint111?cluster=devnet",
    );
    expect(explorerAccountUrl("Mint111", "mainnet-beta")).toBe(
      "https://explorer.solana.com/address/Mint111",
    );
  });
});

describe("utf8 byte helpers", () => {
  it("counts bytes, not UTF-16 code units", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("玫瑰")).toBe(6); // 3 bytes per CJK char
    expect(utf8ByteLength("🌹")).toBe(4); // astral plane
    expect("玫瑰".length).toBe(2); // what a naive length check would use
  });

  it("truncates without splitting a multi-byte character", () => {
    expect(truncateUtf8("abcdef", 4)).toBe("abcd");
    // 32 bytes fits 10 CJK chars (30 bytes); the 11th would overflow.
    expect(truncateUtf8("一二三四五六七八九十十一", 32)).toBe("一二三四五六七八九十");
    expect(truncateUtf8("🌹🌹", 4)).toBe("🌹");
    expect(truncateUtf8("abc", 0)).toBe("");
    // A shorter limit than one character yields an empty string, never a
    // half-encoded character (which would fail on-chain).
    expect(truncateUtf8("玫", 1)).toBe("");
  });
});

describe("rose NFT metadata", () => {
  const ROSE_ID = "8f7a3c2b-4d5e-4f6a-9b1c-2d3e4f5a6b7c";

  it("binds the asset to the rose id and honours the byte limits", () => {
    const fields = buildRoseNftFields({
      roseId: ROSE_ID,
      roseName: "愿这朵玫瑰在链上永远盛开",
    });

    expect(fields.symbol).toBe(ROSE_NFT_SYMBOL);
    expect(utf8ByteLength(fields.name)).toBeLessThanOrEqual(NFT_NAME_MAX_BYTES);
    expect(fields.additionalMetadata[0]).toEqual(["roseId", ROSE_ID]);

    // The full words are preserved in the message field even when the name had
    // to be cut — the name is a display label, the message is the record.
    const message = fields.additionalMetadata.find(([k]) => k === "message");
    expect(message?.[1]).toBe("愿这朵玫瑰在链上永远盛开");

    for (const [, value] of fields.additionalMetadata) {
      expect(utf8ByteLength(value)).toBeLessThanOrEqual(NFT_FIELD_VALUE_MAX_BYTES);
    }
    expect(utf8ByteLength(fields.uri)).toBeLessThanOrEqual(NFT_URI_MAX_BYTES);
  });

  it("always produces a non-empty uri (the backend rejects an empty one)", () => {
    const withoutImage = buildRoseNftFields({ roseId: ROSE_ID, roseName: "hi" });
    expect(withoutImage.uri).toBe(
      `https://roselet-web.vercel.app/rose/${ROSE_ID}`,
    );

    const withImage = buildRoseNftFields({ roseId: ROSE_ID, imageCid: "bafyabc" });
    expect(withImage.uri).toBe("ipfs://bafyabc");
  });

  it("falls back to the default name and omits an empty message", () => {
    const fields = buildRoseNftFields({ roseId: ROSE_ID, roseName: "   " });
    expect(fields.name).toBe("Roselet Rose");
    expect(fields.additionalMetadata.map(([k]) => k)).toEqual(["roseId"]);
  });

  it("truncates a very long message instead of rejecting it", () => {
    const long = buildRoseNftFields({
      roseId: ROSE_ID,
      roseName: "长".repeat(300),
    });
    const message = long.additionalMetadata.find(([k]) => k === "message");
    expect(utf8ByteLength(message![1])).toBeLessThanOrEqual(NFT_FIELD_VALUE_MAX_BYTES);
  });

  it("strips a trailing slash from the configured site url", () => {
    const fields = buildRoseNftFields({
      roseId: ROSE_ID,
      siteUrl: "https://example.test/",
    });
    expect(fields.uri).toBe(`https://example.test/rose/${ROSE_ID}`);
  });
});

describe("lamportsToSol", () => {
  it("formats SOL without trailing zeros", () => {
    expect(lamportsToSol(5_000_000)).toBe("0.005");
    expect(lamportsToSol(4_831_080)).toBe("0.0048");
    expect(lamportsToSol(1_000_000_000)).toBe("1");
  });
});
