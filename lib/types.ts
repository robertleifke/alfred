export type TreasuryPolicy = {
  runwayDays: number;
  maxNgnmShareOfTreasury: number;
  maxSlippageBps: number;
  minUsdtReserve: number;
};

export type TreasuryBalances = {
  usdt: number;
  ngnm: number;
};

export type Obligation = {
  id: string;
  label: string;
  amountNgnm: number;
  dueInDays: number;
  recipient: string;
};

export type Quote = {
  pair: "USDT/KESm";
  usdtToNgnmRate: number;
  slippageBps: number;
  priceImpactBps: number;
  venue: string;
  source?: "scenario" | "uniswap";
  requestId?: string | null;
};

export type DecisionAction = "HOLD" | "BUY_NGNM";

export type Decision = {
  action: DecisionAction;
  amountUsdt: number;
  amountNgnm: number;
  runwayTargetNgnm: number;
  exposureAfterTrade: number;
  reserveAfterTradeUsdt: number;
  rationale: string[];
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  balances: TreasuryBalances;
  obligations: Obligation[];
  quote: Quote;
};

export type ExecutionResult = {
  mode: "simulation" | "live";
  status: "preview" | "executed" | "skipped" | "failed";
  txHash: string | null;
  approvalTxHash?: string | null;
  venue: string;
  settlementRecipient: string | null;
  summary: string;
  requestId?: string | null;
  error?: string | null;
};

export type AlfredRun = {
  scenario: Scenario;
  policy: TreasuryPolicy;
  decision: Decision;
  execution: ExecutionResult;
  updatedBalances: TreasuryBalances;
  liveExecutionReady: boolean;
};
