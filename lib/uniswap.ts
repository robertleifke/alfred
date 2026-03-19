import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import { celo } from "viem/chains";

import { getExecutionConfig } from "@/lib/env";
import type { Quote } from "@/lib/types";

const UNISWAP_API_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";
const CELO_CHAIN_ID = 42220;

type UniswapQuoteResponse = {
  requestId?: string;
  quote: {
    input?: {
      token: string;
      amount: string;
    };
    output?: {
      token: string;
      amount: string;
      recipient?: string;
    };
    aggregatedOutputs?: Array<{
      token: string;
      amount: string;
      recipient?: string;
      minAmount?: string;
    }>;
    slippage?: number;
    slippageTolerance?: number;
    priceImpact?: number;
    quoteId?: string;
    gasFee?: string;
    gasFeeUSD?: string;
    gasFeeQuote?: string;
    route?: unknown[];
    routeString?: string;
    gasUseEstimate?: string;
    blockNumber?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    txFailureReasons?: string[];
    swapper?: string;
    chainId?: number;
    tradeType?: "EXACT_INPUT" | "EXACT_OUTPUT";
    portionBips?: number;
    portionAmount?: string;
    portionRecipient?: string;
  };
  routing?: string;
  permitData?: unknown | null;
};

type UniswapTxRequest = {
  to: `0x${string}`;
  from: `0x${string}`;
  data: `0x${string}`;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
};

type CheckApprovalResponse = {
  requestId?: string;
  approval: UniswapTxRequest | null;
  cancel: UniswapTxRequest | null;
};

type CreateSwapResponse = {
  requestId?: string;
  swap: UniswapTxRequest;
};

function assertConfigured() {
  const config = getExecutionConfig();

  if (!config) {
    throw new Error("Live execution is not configured. Fill the Alfred env vars first.");
  }

  return config;
}

function decimalToBaseUnits(amount: number, decimals: number) {
  const normalized = amount.toFixed(Math.min(decimals, 6));
  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return `${BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0")}`;
}

function baseUnitsToDecimal(amount: string, decimals: number) {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionString = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return Number(fractionString ? `${whole}.${fractionString}` : whole.toString());
}

function toQuoteFromResponse(
  response: UniswapQuoteResponse,
  usdtDecimals: number,
  ngnmDecimals: number,
): Quote {
  const outputAmount =
    response.quote.output?.amount ?? response.quote.aggregatedOutputs?.[0]?.amount ?? "0";
  const inputAmount = response.quote.input?.amount ?? "1";
  const inputDecimal = baseUnitsToDecimal(inputAmount, usdtDecimals);
  const outputDecimal = baseUnitsToDecimal(outputAmount, ngnmDecimals);
  const usdtToNgnmRate = inputDecimal > 0 ? outputDecimal / inputDecimal : 0;

  return {
    pair: "USDT/KESm",
    usdtToNgnmRate,
    slippageBps: response.quote.slippageTolerance ?? response.quote.slippage ?? 0,
    priceImpactBps: Math.round((response.quote.priceImpact ?? 0) * 100),
    venue: response.routing ? `Uniswap ${response.routing} on Celo` : "Uniswap API on Celo",
    source: "uniswap",
    requestId: response.requestId ?? null,
  };
}

async function postUniswap<T>(path: string, body: unknown): Promise<T> {
  const config = assertConfigured();
  const response = await fetch(`${UNISWAP_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.uniswapApiKey,
      "x-universal-router-version": "2.0",
      "x-permit2-disabled": "true",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Uniswap API ${path} failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchLiveQuote(amountUsdt: number) {
  const config = assertConfigured();
  const amount = decimalToBaseUnits(amountUsdt, config.usdtDecimals);
  const response = await postUniswap<UniswapQuoteResponse>("/quote", {
    type: "EXACT_INPUT",
    amount,
    tokenInChainId: CELO_CHAIN_ID,
    tokenOutChainId: CELO_CHAIN_ID,
    tokenIn: config.usdtAddress,
    tokenOut: config.ngnmAddress,
    swapper: config.walletAddress,
    slippageTolerance: 40,
    routingPreference: "BEST_PRICE",
    protocols: ["V2", "V3", "V4"],
    urgency: "urgent",
  });

  return {
    raw: response,
    quote: toQuoteFromResponse(response, config.usdtDecimals, config.ngnmDecimals),
    amountOutNgnm: baseUnitsToDecimal(
      response.quote.output?.amount ?? response.quote.aggregatedOutputs?.[0]?.amount ?? "0",
      config.ngnmDecimals,
    ),
  };
}

function buildPublicClient() {
  const config = assertConfigured();
  return createPublicClient({
    chain: celo,
    transport: http(config.rpcUrl),
  });
}

function buildWalletClient() {
  const config = assertConfigured();
  const account = privateKeyToAccount(config.privateKey);
  return createWalletClient({
    account,
    chain: celo,
    transport: http(config.rpcUrl),
  });
}

async function sendPreparedTransaction(transaction: UniswapTxRequest) {
  const walletClient = buildWalletClient();
  const publicClient = buildPublicClient();
  const baseRequest = {
    account: walletClient.account,
    to: transaction.to,
    data: transaction.data,
    value: BigInt(transaction.value),
    gas: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
    chain: celo,
  } as const;

  const hash =
    transaction.maxFeePerGas || transaction.maxPriorityFeePerGas
      ? await walletClient.sendTransaction({
          ...baseRequest,
          maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
            ? BigInt(transaction.maxPriorityFeePerGas)
            : undefined,
        })
      : await walletClient.sendTransaction({
          ...baseRequest,
          gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined,
        });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function ensureApproval(amountUsdt: number) {
  const config = assertConfigured();
  const amount = decimalToBaseUnits(amountUsdt, config.usdtDecimals);
  const response = await postUniswap<CheckApprovalResponse>("/check_approval", {
    walletAddress: config.walletAddress,
    token: config.usdtAddress,
    amount,
    chainId: CELO_CHAIN_ID,
    urgency: "urgent",
    includeGasInfo: true,
    tokenOut: config.ngnmAddress,
    tokenOutChainId: CELO_CHAIN_ID,
  });

  if (response.cancel) {
    await sendPreparedTransaction(response.cancel);
  }

  if (!response.approval) {
    return {
      requestId: response.requestId ?? null,
      approvalTxHash: null,
    };
  }

  const approvalTxHash = await sendPreparedTransaction(response.approval);
  return {
    requestId: response.requestId ?? null,
    approvalTxHash,
  };
}

export async function executeLiveSwap(rawQuote: UniswapQuoteResponse) {
  const response = await postUniswap<CreateSwapResponse>("/swap", {
    quote: rawQuote.quote,
    simulateTransaction: true,
    safetyMode: "SAFE",
    urgency: "urgent",
  });

  const txHash = await sendPreparedTransaction(response.swap);

  return {
    requestId: response.requestId ?? null,
    txHash,
  };
}
