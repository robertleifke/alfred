# Alfred

**FX Treasury Copilot**

Alfred is an AI agent that let's USDT funded lenders with NGNm cashflows manage their treasury. It monitors balances, forecasts obligations, and executes onchain FX conversions and settlements using the Uniswap API.

Built on Celo. Powered by Uniswap.


## Problem

USDT funded businesses operating in markets like Nigeria face continuous FX risk:

- Revenue and funding in USDT
- Cashflows in local currency NGNm
- High volatility and frequent devaluation
- Manual treasury operations → costly mistakes

Teams either:
- Convert too early → hold depreciating NGNm
- Convert too late → miss payments or face bad rates


## Solution

Alfred automates FX treasury management:

- Maintains optimal NGNm balances
- Converts USDT → NGNm just-in-time
- Minimizes exposure to devaluation
- Executes real onchain swaps via Uniswap
- Settles payments and logs all activity

## How It Works

Alfred runs a continuous decision loop:

1. **Observe**
   - Reads USDT and NGNm balances
   - Ingests upcoming NGN obligations (loans, payouts)

2. **Decide**
   - Computes required NGN runway
   - Determines whether to buy or sell NGNm

3. **Execute**
   - Requests route via Uniswap API
   - Approves tokens via Permit2
   - Executes swap (USDT → NGNm)
   - Sends NGNm to recipient wallet

4. **Verify**
   - Confirms transaction
   - Records tx hash, rates, balances

## Example

A lender has:

- $500,000 in USDT
- ₦30,000,000 in loan disbursements due tomorrow

Alfred:
- Calculates NGN shortfall
- Swaps USDT → NGNm via Uniswap
- Sends NGNm to payout wallet
- Avoids holding NGN early and reduces FX risk


## Why Uniswap

Uniswap is the execution layer:

- Supports real transaction settlement

Alfred integrates:
- Uniswap API (routing + execution)
- Permit2 (token approvals)

All swaps produce real transaction hashes onchain.

## Tech Stack

- **Chain:** Celo
- **Base Asset:** USDT
- **Local Asset:** NGNm
- **Execution:** Uniswap API
- **Approvals:** Permit2
- **Frontend:** Next.js
- **Backend Agent:** Node.js / TypeScript
- **DB:** Supabase

## Demo

- Maintain 7 days of NGN runway
- Never hold more than 20% of treasury in NGN
- Max slippage: 40 bps
- Minimum USDT reserve: $10


