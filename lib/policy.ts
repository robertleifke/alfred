import type { TreasuryPolicy } from "@/lib/types";

export const defaultPolicy: TreasuryPolicy = {
  runwayDays: 7,
  maxNgnmShareOfTreasury: 0.2,
  maxSlippageBps: 40,
  minUsdtReserve: 10,
};
