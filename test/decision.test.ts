import test from "node:test";
import assert from "node:assert/strict";

import { decideTreasuryAction } from "@/lib/decision";
import { planAlfredScenario } from "@/lib/execution";
import { demoScenarios } from "@/lib/scenarios";

test("buys KESm when runway is below target", () => {
  const scenario = demoScenarios[0];
  const decision = decideTreasuryAction({
    balances: scenario.balances,
    obligations: scenario.obligations,
    quote: scenario.quote,
  });

  assert.equal(decision.action, "BUY_NGNM");
  assert.ok(decision.amountUsdt > 0);
  assert.ok(decision.amountNgnm > 0);
});

test("holds when current KESm already covers runway", () => {
  const scenario = demoScenarios[1];
  const decision = decideTreasuryAction({
    balances: scenario.balances,
    obligations: scenario.obligations,
    quote: scenario.quote,
  });

  assert.equal(decision.action, "HOLD");
  assert.equal(decision.amountUsdt, 0);
});

test("preserves the USDT reserve when capital is tight", () => {
  const scenario = demoScenarios[2];
  const decision = decideTreasuryAction({
    balances: scenario.balances,
    obligations: scenario.obligations,
    quote: scenario.quote,
  });

  assert.equal(decision.reserveAfterTradeUsdt >= 10, true);
  assert.equal(decision.action, "BUY_NGNM");
});

test("planning stays in preview mode when live execution is not configured", async () => {
  const run = await planAlfredScenario(demoScenarios[0]);

  assert.equal(run.liveExecutionReady, false);
  assert.equal(run.execution.status, "preview");
  assert.equal(run.execution.mode, "simulation");
});
