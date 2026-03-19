import crypto from "node:crypto";

import { decideTreasuryAction } from "@/lib/decision";
import { isLiveExecutionConfigured } from "@/lib/env";
import { defaultPolicy } from "@/lib/policy";
import { fetchLiveQuote, ensureApproval, executeLiveSwap } from "@/lib/uniswap";
import type { AlfredRun, ExecutionResult, Scenario, TreasuryBalances, TreasuryPolicy } from "@/lib/types";

function buildUpdatedBalances(
  balances: TreasuryBalances,
  amountUsdt: number,
  amountLocalAsset: number,
): TreasuryBalances {
  return {
    usdt: Math.round((balances.usdt - amountUsdt) * 100) / 100,
    localAsset: Math.round((balances.localAsset + amountLocalAsset) * 100) / 100,
  };
}

function simulateExecution(
  scenario: Scenario,
  amountUsdt: number,
  amountLocalAsset: number,
): ExecutionResult {
  if (amountUsdt <= 0 || amountLocalAsset <= 0) {
    return {
      mode: "simulation",
      status: "skipped",
      txHash: null,
      venue: scenario.quote.venue,
      settlementRecipient: null,
      summary: "No swap executed because Alfred chose to hold.",
      approvalTxHash: null,
      requestId: null,
      error: null,
    };
  }

  const firstRecipient = scenario.obligations[0]?.recipient ?? null;
  const txHash = `0x${crypto
    .createHash("sha256")
    .update(`${scenario.id}:${amountUsdt}:${amountLocalAsset}`)
    .digest("hex")}`;

  return {
    mode: "simulation",
    status: "preview",
    txHash,
    approvalTxHash: null,
    venue: scenario.quote.venue,
    settlementRecipient: firstRecipient,
    summary: `Previewed swap of USDT ${amountUsdt} into KESm ${amountLocalAsset}. Execute live only after env and wallet are configured.`,
    requestId: null,
    error: null,
  };
}

export async function planAlfredScenario(
  scenario: Scenario,
  policy: TreasuryPolicy = defaultPolicy,
): Promise<AlfredRun> {
  let quote = scenario.quote;
  let decision = decideTreasuryAction({
    balances: scenario.balances,
    obligations: scenario.obligations,
    quote,
    policy,
  });

  if (isLiveExecutionConfigured() && decision.action === "BUY_NGNM" && decision.amountUsdt > 0) {
    try {
      const liveQuote = await fetchLiveQuote(decision.amountUsdt);
      quote = liveQuote.quote;
      decision = {
        ...decision,
        amountLocalAsset: Math.round(liveQuote.amountOutLocalAsset * 100) / 100,
        rationale: [...decision.rationale, "Fetched a live Uniswap quote for the planned swap amount."],
      };
    } catch (error) {
      decision = {
        ...decision,
        rationale: [
          ...decision.rationale,
          `Live quote fetch failed, falling back to scenario pricing: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        ],
      };
    }
  }

  const execution = simulateExecution(
    { ...scenario, quote },
    decision.amountUsdt,
    decision.amountLocalAsset,
  );
  const updatedBalances =
    execution.status === "preview" || execution.status === "executed"
      ? buildUpdatedBalances(scenario.balances, decision.amountUsdt, decision.amountLocalAsset)
      : scenario.balances;

  return {
    scenario: { ...scenario, quote },
    policy,
    decision,
    execution,
    updatedBalances,
    liveExecutionReady: isLiveExecutionConfigured(),
  };
}

export async function executeAlfredScenario(
  scenario: Scenario,
  policy: TreasuryPolicy = defaultPolicy,
): Promise<AlfredRun> {
  const plannedRun = await planAlfredScenario(scenario, policy);

  if (plannedRun.decision.action !== "BUY_NGNM" || plannedRun.decision.amountUsdt <= 0) {
    return {
      ...plannedRun,
      execution: {
        ...plannedRun.execution,
        status: "skipped",
      },
    };
  }

  if (!plannedRun.liveExecutionReady) {
    return plannedRun;
  }

  try {
    const approval = await ensureApproval(plannedRun.decision.amountUsdt);
    const liveQuote = await fetchLiveQuote(plannedRun.decision.amountUsdt);
    const swap = await executeLiveSwap(liveQuote.raw);

    return {
      ...plannedRun,
      scenario: {
        ...plannedRun.scenario,
        quote: liveQuote.quote,
      },
      decision: {
        ...plannedRun.decision,
        amountLocalAsset: Math.round(liveQuote.amountOutLocalAsset * 100) / 100,
        rationale: [...plannedRun.decision.rationale, "Live swap executed through the Uniswap API on Celo."],
      },
      execution: {
        mode: "live",
        status: "executed",
        txHash: swap.txHash,
        approvalTxHash: approval.approvalTxHash,
        venue: liveQuote.quote.venue,
        settlementRecipient: scenario.obligations[0]?.recipient ?? null,
        summary: `Executed live swap of USDT ${plannedRun.decision.amountUsdt} into KESm ${Math.round(liveQuote.amountOutLocalAsset * 100) / 100}.`,
        requestId: swap.requestId ?? approval.requestId ?? liveQuote.quote.requestId ?? null,
        error: null,
      },
      updatedBalances: buildUpdatedBalances(
        plannedRun.scenario.balances,
        plannedRun.decision.amountUsdt,
        Math.round(liveQuote.amountOutLocalAsset * 100) / 100,
      ),
    };
  } catch (error) {
    return {
      ...plannedRun,
      execution: {
        mode: "live",
        status: "failed",
        txHash: null,
        approvalTxHash: null,
        venue: plannedRun.scenario.quote.venue,
        settlementRecipient: scenario.obligations[0]?.recipient ?? null,
        summary: "Live execution failed before settlement completed.",
        requestId: plannedRun.scenario.quote.requestId ?? null,
        error: error instanceof Error ? error.message : "Unknown execution error.",
      },
    };
  }
}
