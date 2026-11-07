import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  isAddress,
  parseAbi,
  padHex,
  type Address,
  type EIP1193Provider,
} from "viem";
import { baseSepolia } from "viem/chains";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const memorialAbi = parseAbi([
  "function mint(bytes32 roseId, string message, uint8 color) returns (uint256 tokenId)",
]);

function contractAddress(): Address {
  const address = process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new Error("链上纪念版尚未配置");
  }
  return address;
}

function colorIndex(color: string): number {
  const colors: Record<string, number> = { red: 0, white: 1, yellow: 2 };
  const index = colors[color];
  if (index === undefined) throw new Error("不支持的玫瑰颜色");
  return index;
}

function roseIdToBytes32(roseId: string) {
  const compactId = roseId.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(compactId)) throw new Error("无效的玫瑰编号");
  return padHex(`0x${compactId}`, { size: 32 });
}

export async function mintRoseMemorial(roseId: string, color: string, message: string) {
  if (!window.ethereum) throw new Error("请先安装或打开钱包扩展");

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: custom(window.ethereum),
  });
  const [account] = await walletClient.requestAddresses();
  if (!account) throw new Error("没有可用的钱包账户");

  await walletClient.switchChain({ id: baseSepolia.id });
  const hash = await walletClient.writeContract({
    address: contractAddress(),
    abi: memorialAbi,
    functionName: "mint",
    account,
    args: [roseIdToBytes32(roseId), message, colorIndex(color)],
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  });
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return { txHash: hash, walletAddress: account };
}

export function baseSepoliaTransactionUrl(txHash: string) {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
