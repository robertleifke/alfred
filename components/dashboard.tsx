"use client";

import { useEffect, useState, useTransition } from "react";

import type { AlfredRun } from "@/lib/types";

type DashboardProps = {
  initialRun: AlfredRun;
  scenarioOptions: {
    id: string;
    name: string;
  }[];
};

function formatMoney(value: number, unit: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value) + ` ${unit}`;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warning";
}) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Dashboard({ initialRun, scenarioOptions }: DashboardProps) {
  const [run, setRun] = useState(initialRun);
  const [scenarioId, setScenarioId] = useState(initialRun.scenario.id);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExecuting, startExecution] = useTransition();

  useEffect(() => {
    setRun(initialRun);
    setScenarioId(initialRun.scenario.id);
    setExecutionMessage(null);
  }, [initialRun]);

  function handleScenarioChange(nextScenarioId: string) {
    setScenarioId(nextScenarioId);
    setExecutionMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/run?scenario=${nextScenarioId}`);
      const payload = (await response.json()) as AlfredRun;
      setRun(payload);
    });
  }

  function handleExecute() {
    setExecutionMessage(null);
    startExecution(async () => {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const payload = (await response.json()) as AlfredRun;
      setRun(payload);
      setExecutionMessage(
        payload.execution.status === "executed"
          ? "Live swap submitted and confirmed."
          : payload.execution.error ?? payload.execution.summary,
      );
    });
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Agentic FX Treasury on Celo</p>
          <h1>Alfred decides when to hold dollars and when to buy runway.</h1>
          <p className="lede">
            This MVP models Alfred as a continuous treasury loop for USDT-funded lenders with KESm
            obligations in Kenya. It observes balances, computes runway, applies treasury policy, and
            simulates an execution through the Uniswap API on Celo.
          </p>
        </div>

        <div className="hero-panel">
          <label htmlFor="scenario-select">Demo scenario</label>
          <select
            id="scenario-select"
            value={scenarioId}
            onChange={(event) => handleScenarioChange(event.target.value)}
          >
            {scenarioOptions.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          <p>{run.scenario.description}</p>
          <div className="status-row">
            <span className={`status-pill status-${run.decision.action.toLowerCase()}`}>
              {run.decision.action}
            </span>
            <span>
              {isPending
                ? "Refreshing scenario..."
                : run.liveExecutionReady
                  ? "Live execution enabled"
                  : "Preview mode only"}
            </span>
          </div>
          <button
            className="execute-button"
            type="button"
            onClick={handleExecute}
            disabled={!run.liveExecutionReady || run.decision.action !== "BUY_NGNM" || isExecuting}
          >
            {isExecuting ? "Executing..." : "Execute live swap"}
          </button>
          <p className="helper-copy">
            {run.liveExecutionReady
              ? "The button sends a real approval and swap transaction from the configured wallet."
              : "Add Alfred env vars to unlock real Uniswap quotes and live execution."}
          </p>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Observe</h2>
          <div className="stats">
            <StatCard label="USDT balance" value={formatMoney(run.scenario.balances.usdt, "USDT")} />
            <StatCard label="KESm balance" value={formatMoney(run.scenario.balances.localAsset, "KESm")} />
            <StatCard
              label="Runway target"
              value={formatMoney(run.decision.runwayTargetLocalAsset, "KESm")}
              tone="accent"
            />
          </div>
          <div className="subpanel">
            <h3>Upcoming obligations</h3>
            <ul className="list">
              {run.scenario.obligations.map((obligation) => (
                <li key={obligation.id}>
                  <span>{obligation.label}</span>
                  <strong>
                    {formatMoney(obligation.amountLocalAsset, "KESm")} due in {obligation.dueInDays} day
                    {obligation.dueInDays === 1 ? "" : "s"}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <h2>Decide</h2>
          <div className="stats">
            <StatCard
              label="Trade amount"
              value={formatMoney(run.decision.amountUsdt, "USDT")}
              tone={run.decision.action === "BUY_NGNM" ? "accent" : "default"}
            />
            <StatCard
              label="KESm acquired"
              value={formatMoney(run.decision.amountLocalAsset, "KESm")}
              tone={run.decision.action === "BUY_NGNM" ? "accent" : "default"}
            />
            <StatCard
              label="Exposure after trade"
              value={`${(run.decision.exposureAfterTrade * 100).toFixed(2)}%`}
              tone={run.decision.exposureAfterTrade > 0.2 ? "warning" : "default"}
            />
          </div>
          <div className="subpanel">
            <h3>Policy checks</h3>
            <ul className="list rationale">
              <li>Runway: {run.policy.runwayDays} days</li>
              <li>Max KESm exposure: {(run.policy.maxLocalAssetShareOfTreasury * 100).toFixed(0)}%</li>
              <li>Max slippage: {run.policy.maxSlippageBps} bps</li>
              <li>Min USDT reserve: {formatMoney(run.policy.minUsdtReserve, "USDT")}</li>
            </ul>
            <ul className="list rationale">
              {run.decision.rationale.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel panel-wide">
          <h2>Execute + Verify</h2>
          <div className="stats">
            <StatCard label="Venue" value={run.execution.venue} />
              <StatCard
                label="Quote rate"
              value={`1 USDT = ${formatMoney(run.scenario.quote.usdtToLocalAssetRate, "KESm")}`}
            />
            <StatCard label="Slippage" value={`${run.scenario.quote.slippageBps} bps`} />
          </div>
          <div className="execution-block">
            <div>
              <p className="block-label">Execution mode</p>
              <strong>{run.execution.mode}</strong>
            </div>
            <div>
              <p className="block-label">Status</p>
              <strong>{run.execution.status}</strong>
            </div>
            <div>
              <p className="block-label">Transaction hash</p>
              <strong className="hash">{run.execution.txHash ?? "Not executed"}</strong>
            </div>
          </div>
          <div className="execution-block">
            <div>
              <p className="block-label">Approval tx</p>
              <strong className="hash">{run.execution.approvalTxHash ?? "Not required"}</strong>
            </div>
            <div>
              <p className="block-label">Quote request</p>
              <strong className="hash">{run.scenario.quote.requestId ?? "Scenario quote"}</strong>
            </div>
            <div>
              <p className="block-label">Quote source</p>
              <strong>{run.scenario.quote.source ?? "scenario"}</strong>
            </div>
          </div>
          <p className="summary">{run.execution.summary}</p>
          {executionMessage ? <p className="summary">{executionMessage}</p> : null}
          {run.execution.error ? <p className="summary error-copy">{run.execution.error}</p> : null}
          <div className="stats">
            <StatCard label="USDT after run" value={formatMoney(run.updatedBalances.usdt, "USDT")} />
            <StatCard label="KESm after run" value={formatMoney(run.updatedBalances.localAsset, "KESm")} />
            <StatCard
              label="Reserve after run"
              value={formatMoney(run.decision.reserveAfterTradeUsdt, "USDT")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
