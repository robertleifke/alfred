# Alfred

**Stablecoin treasury manager built with Uniswap API and Celo stablecoins.**

It models an AI treasury agent that watches USDT and KESm balances, evaluates upcoming Kenya obligations, decides whether to buy KESm, and can execute a real `USDT -> KESm` swap through Uniswap on Celo when wallet and API credentials are configured.

## What the MVP proves

- Alfred observes balances and upcoming obligations.
- Alfred applies explicit treasury policy instead of vague agent intuition.
- Alfred decides whether to hold USDT or buy KESm.
- Alfred previews swaps safely by default and can execute them live through Uniswap on Celo when configured.
- Alfred shows the entire loop in a minimal dashboard.

## Current live pair

The shipped live integration is configured for:

- `USDT` on Celo: `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- `KESm` on Celo: `0x456a3D042C0DbD3db53D5489e98dFb038553B0d0`
- Chain: `Celo Mainnet`
- Router / quote source: `Uniswap Trading API`

## Treasury policy

The decision engine implements the policy described in the original concept:

- Maintain `7` days of KESm runway
- Never hold more than `20%` of treasury value in KESm
- Reject trades above `40` bps slippage
- Preserve a minimum `10 USDT` reserve

## Demo scenarios

The dashboard ships with three scenarios:

1. `Tomorrow payout crunch`
2. `Healthy runway`
3. `Tight reserve`

These demonstrate Alfred buying KESm for Kenya payouts, holding when runway is already healthy, and respecting reserve constraints when capital is tight.

## Project structure

- `app/`: Next.js app router UI and API route
- `components/`: dashboard UI
- `lib/`: policy, scenarios, decision engine, Uniswap client, and execution flow
- `test/`: node-based decision tests

## Local development

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Fill these values before live trading:

- `ALFRED_UNISWAP_API_KEY`
- `ALFRED_RPC_URL` defaults to Celo Forno `https://forno.celo.org`
- `ALFRED_PRIVATE_KEY`
- `ALFRED_WALLET_ADDRESS`
- `ALFRED_USDT_ADDRESS` defaults to Celo USDT `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- `ALFRED_LOCAL_ASSET_ADDRESS` defaults to Celo KESm `0x456a3D042C0DbD3db53D5489e98dFb038553B0d0`
- `ALFRED_LOCAL_ASSET_DECIMALS` defaults to `18`

Without them, Alfred stays in safe preview mode.

Start the app:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Open `http://localhost:3000`.

## Live execution flow

When the env vars are present, Alfred uses the official Uniswap trading API workflow:

1. Plan the treasury action locally.
2. Fetch a live `/quote` from the Uniswap API on Celo.
3. Check token approval with `/check_approval`.
4. Build calldata with `/swap`.
5. Sign and send the approval and swap transactions through the configured wallet.

The UI never executes a live trade automatically on page load. A real swap only happens after you click the explicit execute button.

## Implementation notes

- Internally, Alfred now models the payout currency as a generic `local asset` so the same engine can be reused for other regional stablecoins later.
- The current demo labels that local asset as `KESm`.
- The live path uses direct approval plus swap execution through Uniswap's Trading API. Permit2 signing is not required for the current demo path.

## What is still missing for a stronger final submission

1. Persist run history and balances.
2. Add a real payout transfer after the swap settles.
3. Replace scenario balances with live onchain balance reads.
4. Record human-agent collaboration logs for Synthesis.
5. Optionally upgrade from direct approval flow to full Permit2 signing.

## Submission framing

Pitch Alfred as:

> An autonomous FX treasury agent for stablecoin-funded lenders operating in volatile local-currency markets.

That framing keeps the project inside the Synthesis theme of agents that pay while making the user value clear.
