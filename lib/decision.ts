import { defaultPolicy } from "@/lib/policy";
import type { Decision, Obligation, Quote, TreasuryBalances, TreasuryPolicy } from "@/lib/types";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function obligationsWithinRunway(obligations: Obligation[], runwayDays: number) {
  return obligations.filter((obligation) => obligation.dueInDays <= runwayDays);
}

export function computeRunwayTargetNgnm(obligations: Obligation[], runwayDays: number) {
  return obligationsWithinRunway(obligations, runwayDays).reduce(
    (sum, obligation) => sum + obligation.amountNgnm,
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
  const runwayTargetNgnm = computeRunwayTargetNgnm(obligations, policy.runwayDays);
  const shortfallNgnm = Math.max(0, runwayTargetNgnm - balances.ngnm);

  rationale.push(`Runway target within ${policy.runwayDays} days is KESm ${roundCurrency(runwayTargetNgnm)}.`);

  if (quote.slippageBps > policy.maxSlippageBps) {
    rationale.push(
      `Quote rejected because slippage is ${quote.slippageBps} bps, above the ${policy.maxSlippageBps} bps limit.`,
    );

    const ngnmValueInUsdt = balances.ngnm / quote.usdtToNgnmRate;
    const exposureAfterTrade = ngnmValueInUsdt / (balances.usdt + ngnmValueInUsdt);

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountNgnm: 0,
      runwayTargetNgnm: roundCurrency(runwayTargetNgnm),
      exposureAfterTrade: roundCurrency(exposureAfterTrade),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  if (shortfallNgnm <= 0) {
    rationale.push("Current KESm balance already covers the target runway.");
    const ngnmValueInUsdt = balances.ngnm / quote.usdtToNgnmRate;
    const exposureAfterTrade = ngnmValueInUsdt / (balances.usdt + ngnmValueInUsdt);

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountNgnm: 0,
      runwayTargetNgnm: roundCurrency(runwayTargetNgnm),
      exposureAfterTrade: roundCurrency(exposureAfterTrade),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  const shortfallUsdt = shortfallNgnm / quote.usdtToNgnmRate;
  const availableUsdt = Math.max(0, balances.usdt - policy.minUsdtReserve);
  const maxNgnmFromReserveRule = availableUsdt * quote.usdtToNgnmRate;
  const treasuryValueUsdt = balances.usdt + balances.ngnm / quote.usdtToNgnmRate;
  const maxNgnmValueUsdt = treasuryValueUsdt * policy.maxNgnmShareOfTreasury;
  const currentNgnmValueUsdt = balances.ngnm / quote.usdtToNgnmRate;
  const maxAdditionalNgnmUsdt = Math.max(0, maxNgnmValueUsdt - currentNgnmValueUsdt);
  const targetTradeUsdt = Math.min(shortfallUsdt, availableUsdt, maxAdditionalNgnmUsdt);
  const amountUsdt = Math.max(0, targetTradeUsdt);
  const amountNgnm = amountUsdt * quote.usdtToNgnmRate;
  const reserveAfterTradeUsdt = balances.usdt - amountUsdt;
  const newNgnmValueUsdt = (balances.ngnm + amountNgnm) / quote.usdtToNgnmRate;
  const exposureAfterTrade = newNgnmValueUsdt / (reserveAfterTradeUsdt + newNgnmValueUsdt);

  rationale.push(`Current shortfall is KESm ${roundCurrency(shortfallNgnm)}.`);

  if (availableUsdt < shortfallUsdt) {
    rationale.push(
      `USDT reserve rule caps the trade at USDT ${roundCurrency(availableUsdt)} to preserve the minimum reserve.`,
    );
  }

  if (maxAdditionalNgnmUsdt < shortfallUsdt && maxAdditionalNgnmUsdt <= availableUsdt) {
    rationale.push(
      `KESm exposure cap limits this trade to USDT ${roundCurrency(maxAdditionalNgnmUsdt)} equivalent.`,
    );
  }

  if (amountUsdt <= 0) {
    rationale.push("No safe trade size is available under the current policy constraints.");

    return {
      action: "HOLD",
      amountUsdt: 0,
      amountNgnm: 0,
      runwayTargetNgnm: roundCurrency(runwayTargetNgnm),
      exposureAfterTrade: roundCurrency(currentNgnmValueUsdt / treasuryValueUsdt),
      reserveAfterTradeUsdt: roundCurrency(balances.usdt),
      rationale,
    };
  }

  rationale.push(`Buy KESm now to protect the runway with ${quote.venue}.`);

  return {
    action: "BUY_NGNM",
    amountUsdt: roundCurrency(amountUsdt),
    amountNgnm: roundCurrency(amountNgnm),
    runwayTargetNgnm: roundCurrency(runwayTargetNgnm),
    exposureAfterTrade: roundCurrency(exposureAfterTrade),
    reserveAfterTradeUsdt: roundCurrency(reserveAfterTradeUsdt),
    rationale,
  };
}
