import type { Scenario } from "@/lib/types";

export const demoScenarios: Scenario[] = [
  {
    id: "tomorrow-payout",
    name: "Tomorrow payout crunch",
    description:
      "Large next-day Kenya payout with low KESm runway. Alfred should buy enough KESm to cover the runway target.",
    balances: {
      usdt: 500_000,
      ngnm: 620_000,
    },
    obligations: [
      {
        id: "obl-1",
        label: "Kenya loan disbursements",
        amountNgnm: 3_000_000,
        dueInDays: 1,
        recipient: "0xPayoutDesk001",
      },
      {
        id: "obl-2",
        label: "Field collections float top-up",
        amountNgnm: 1_050_000,
        dueInDays: 5,
        recipient: "0xReserveDesk002",
      },
    ],
    quote: {
      pair: "USDT/KESm",
      usdtToNgnmRate: 129.44,
      slippageBps: 18,
      priceImpactBps: 11,
      venue: "Uniswap API on Celo",
    },
  },
  {
    id: "healthy-runway",
    name: "Healthy runway",
    description:
      "The wallet already has enough KESm runway. Alfred should hold and keep treasury in USDT.",
    balances: {
      usdt: 120_000,
      ngnm: 2_200_000,
    },
    obligations: [
      {
        id: "obl-3",
        label: "Weekly Kenya payouts",
        amountNgnm: 780_000,
        dueInDays: 3,
        recipient: "0xOps001",
      },
      {
        id: "obl-4",
        label: "Collections refund batch",
        amountNgnm: 290_000,
        dueInDays: 6,
        recipient: "0xOps002",
      },
    ],
    quote: {
      pair: "USDT/KESm",
      usdtToNgnmRate: 129.12,
      slippageBps: 12,
      priceImpactBps: 7,
      venue: "Uniswap API on Celo",
    },
  },
  {
    id: "tight-reserve",
    name: "Tight reserve",
    description:
      "The treasury needs KESm, but Alfred must preserve the USDT reserve and cap the trade accordingly.",
    balances: {
      usdt: 4_200,
      ngnm: 18_000,
    },
    obligations: [
      {
        id: "obl-5",
        label: "Field agent payout",
        amountNgnm: 310_000,
        dueInDays: 1,
        recipient: "0xFieldOps001",
      },
      {
        id: "obl-6",
        label: "Agent liquidity float",
        amountNgnm: 180_000,
        dueInDays: 2,
        recipient: "0xFieldOps002",
      },
    ],
    quote: {
      pair: "USDT/KESm",
      usdtToNgnmRate: 128.9,
      slippageBps: 24,
      priceImpactBps: 17,
      venue: "Uniswap API on Celo",
    },
  },
];

export const defaultScenario = demoScenarios[0];

export function getScenarioById(id: string) {
  return demoScenarios.find((scenario) => scenario.id === id) ?? defaultScenario;
}
