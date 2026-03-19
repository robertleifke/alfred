import { defaultPolicy } from "@/lib/policy";
import type { Decision, Obligation, Quote, TreasuryBalances, TreasuryPolicy } from "@/lib/types";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function obligationsWithinRunway(obligations: Obligation[], runwayDays: number) {
  return obligations.filter((obligation) => obligation.dueInDays <= runwayDays);
}

export function computeRunwayTargetLocalAsset(obligations: Obligation[], runwayDays: number) {
  return obligationsWithinRunway(obligations, runwayDays).reduce(
    (sum, obligation) => sum + obligation.amountLocalAsset,
    0,
  );
}

export function decideTreasuryAction({
  balances,
  obligations,
  quote,
  policy = defaultPolicy,
}: {
  balances: TreasuryBalances;
  obligations: Obligation[];
  quote: Quote;
  policy?: TreasuryPolicy;
}): Decision {
  const rationale: string[] = [];
  const runwayTargetLocalAsset = computeRunwayTargetLocalAsset(obligations, policy.runwayDays);
  const shortfallLocalAsset = Math.max(0, runwayTargetLocalAsset - balances.localAsset);

  rationale.push(
    `Runway target within ${policy.runwayDays} days is KESm ${roundCurrency(runwayTargetLocalAsset)}.`,
  );

  if (quote.slippageBps > policy.maxSlippageBps) {
    rationale.push(
      `Quote rejected because slippage is ${quote.slippageBps} bps, above the ${policy.maxSlippageBps} bps limit.`,
    );

    const localAssetValueInUsdt = balances.localAsset / quote.usdtToLocalAssetRate;
    const exposureAfterTrade = localAssetValueInUsdt / (balances.usdt + localAssetValueInUsdt);

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountLocalAsset: 0,
      runwayTargetLocalAsset: roundCurrency(runwayTargetLocalAsset),
      exposureAfterTrade: roundCurrency(exposureAfterTrade),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  if (shortfallLocalAsset <= 0) {
    rationale.push("Current KESm balance already covers the target runway.");
    const localAssetValueInUsdt = balances.localAsset / quote.usdtToLocalAssetRate;
    const exposureAfterTrade = localAssetValueInUsdt / (balances.usdt + localAssetValueInUsdt);

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountLocalAsset: 0,
      runwayTargetLocalAsset: roundCurrency(runwayTargetLocalAsset),
      exposureAfterTrade: roundCurrency(exposureAfterTrade),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  const shortfallUsdt = shortfallLocalAsset / quote.usdtToLocalAssetRate;
  const availableUsdt = Math.max(0, balances.usdt - policy.minUsdtReserve);
  const treasuryValueUsdt = balances.usdt + balances.localAsset / quote.usdtToLocalAssetRate;
  const maxLocalAssetValueUsdt = treasuryValueUsdt * policy.maxLocalAssetShareOfTreasury;
  const currentLocalAssetValueUsdt = balances.localAsset / quote.usdtToLocalAssetRate;
  const maxAdditionalLocalAssetUsdt = Math.max(0, maxLocalAssetValueUsdt - currentLocalAssetValueUsdt);
  const targetTradeUsdt = Math.min(shortfallUsdt, availableUsdt, maxAdditionalLocalAssetUsdt);
  const amountUsdt = Math.max(0, targetTradeUsdt);
  const amountLocalAsset = amountUsdt * quote.usdtToLocalAssetRate;
  const reserveAfterTradeUsdt = balances.usdt - amountUsdt;
  const newLocalAssetValueUsdt =
    (balances.localAsset + amountLocalAsset) / quote.usdtToLocalAssetRate;
  const exposureAfterTrade =
    newLocalAssetValueUsdt / (reserveAfterTradeUsdt + newLocalAssetValueUsdt);

  rationale.push(`Current shortfall is KESm ${roundCurrency(shortfallLocalAsset)}.`);

  if (availableUsdt < shortfallUsdt) {
    rationale.push(
      `USDT reserve rule caps the trade at USDT ${roundCurrency(availableUsdt)} to preserve the minimum reserve.`,
    );
  }

  if (
    maxAdditionalLocalAssetUsdt < shortfallUsdt &&
    maxAdditionalLocalAssetUsdt <= availableUsdt
  ) {
    rationale.push(
      `KESm exposure cap limits this trade to USDT ${roundCurrency(maxAdditionalLocalAssetUsdt)} equivalent.`,
    );
  }

  if (amountUsdt <= 0) {
    rationale.push("No safe trade size is available under the current policy constraints.");

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountLocalAsset: 0,
      runwayTargetLocalAsset: roundCurrency(runwayTargetLocalAsset),
      exposureAfterTrade: roundCurrency(currentLocalAssetValueUsdt / treasuryValueUsdt),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  rationale.push(`Buy KESm now to protect the runway with ${quote.venue}.`);

  return {
    action: "BUY_NGNM",
    amountUsdt: roundCurrency(amountUsdt),
    amountLocalAsset: roundCurrency(amountLocalAsset),
    runwayTargetLocalAsset: roundCurrency(runwayTargetLocalAsset),
    exposureAfterTrade: roundCurrency(exposureAfterTrade),
    reserveAfterTradeUsdt: roundCurrency(reserveAfterTradeUsdt),
    rationale,
  };
}
