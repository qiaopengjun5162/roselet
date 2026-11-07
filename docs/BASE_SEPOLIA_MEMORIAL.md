# Base Sepolia 链上纪念版

Roselet 的首个 Web3 演示功能是“链上纪念版”：公开玫瑰的创建者可以连接自己的钱包，把一条主动选择的短句和玫瑰颜色铸造成 Base Sepolia 上的 ERC-721。完整的感恩、焦虑和期待内容仍只存在 Roselet 数据库。

## 数据边界

- 合约：玫瑰 UUID 的 `bytes32` 表示、短句、颜色、持有人地址和 ERC-721 token id。
- 后端：交易哈希、钱包地址、短句哈希和验证时间。
- 不上链：用户完整情绪内容、昵称、JWT、任何钱包私钥。
- 每个玫瑰 UUID 在 Roselet 数据库中只能有一条已验证纪念版；后端只接受玫瑰创建者提交的匹配交易。合约本身不依赖服务端私钥来阻止第三方对公开 UUID 的非官方铸造，因此产品页只展示后端校验过的官方记录。

## 部署合约

安装 Foundry 和一个仅用于部署的本地测试钱包后，在 `contracts/` 执行：

```bash
pnpm --ignore-workspace install
forge test
forge create src/RoseMemorial.sol:RoseMemorial \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

`DEPLOYER_PRIVATE_KEY` 只能留在本机 shell 或钱包，不可写进 `.env`、服务器或 Git。Base Sepolia 的 chain id 是 `84532`，官方公共 RPC 是 `https://sepolia.base.org`。

## 配置与演示

将部署输出的合约地址同时配置到后端和 Vercel/Cloudflare Pages：

```dotenv
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ROSE_MEMORIAL_CONTRACT_ADDRESS=0x...部署后的合约地址
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS=0x...同一个合约地址
```

后端验证接口会先确认 RPC 属于 Base Sepolia，再检查交易成功、目标合约、`RoseMemorialMinted` 事件内的 rose id、钱包地址、短句 Keccak-256 哈希和颜色。因此浏览器提交的交易哈希不能替代验证记录。

录屏路径：登录 Roselet，打开一朵自己的公开玫瑰，输入一条短句，连接钱包并确认 Base Sepolia 交易，等待页面显示“已在 Base Sepolia 留下链上纪念版”，最后打开 Basescan 交易链接。
