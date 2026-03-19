type AlfredExecutionConfig = {
  uniswapApiKey: string;
  rpcUrl: string;
  privateKey: `0x${string}`;
  walletAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
  localAssetAddress: `0x${string}`;
  usdtDecimals: number;
  localAssetDecimals: number;
};

function requireHexAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null;
  }

  return value as `0x${string}`;
}

function requirePrivateKey(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return null;
  }

  return value as `0x${string}`;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getExecutionConfig(): AlfredExecutionConfig | null {
  const uniswapApiKey = process.env.ALFRED_UNISWAP_API_KEY;
  const rpcUrl = process.env.ALFRED_RPC_URL;
  const privateKey = requirePrivateKey(process.env.ALFRED_PRIVATE_KEY);
  const walletAddress = requireHexAddress(process.env.ALFRED_WALLET_ADDRESS);
  const usdtAddress = requireHexAddress(process.env.ALFRED_USDT_ADDRESS);
  const localAssetAddress = requireHexAddress(
    process.env.ALFRED_LOCAL_ASSET_ADDRESS ?? process.env.ALFRED_NGNM_ADDRESS,
  );

  if (!uniswapApiKey || !rpcUrl || !privateKey || !walletAddress || !usdtAddress || !localAssetAddress) {
    return null;
  }

  return {
    uniswapApiKey,
    rpcUrl,
    privateKey,
    walletAddress,
    usdtAddress,
    localAssetAddress,
    usdtDecimals: parsePositiveInt(process.env.ALFRED_USDT_DECIMALS, 6),
    localAssetDecimals: parsePositiveInt(
      process.env.ALFRED_LOCAL_ASSET_DECIMALS ?? process.env.ALFRED_NGNM_DECIMALS,
      18,
    ),
  };
}

export function isLiveExecutionConfigured() {
  return getExecutionConfig() !== null;
}
