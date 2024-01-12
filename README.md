# Table of Contents

- [Direct Offer Offchain](#direct-offer-offchain)
  - [Introduction](#introduction)
  - [Documentation](#documentation)
    - [What is P2P trading?](#what-is-peer-to-peer-p2p-trading)
    - [How can this project facilitate P2P trading?](#how-can-this-project-facilitate-p2p-trading)
  - [Usage Example](#usage-example)
    - [Setup](#setup-lucid--offer-scripts)
    - [Make Offer](#make-offer)
    - [Fetch Offer](#fetch-offer)
    - [Accept Offer](#accept-offer)
  - [License](#license)

# Direct Offer Offchain

## Introduction

The Direct Offer Offchain project provides a typescript based SDK to convenietly interact with Plutarch-based implementation of a smart contract enabling peer-to-peer trading, in a trustless manner, for the Cardano blockchain. Without the need for a trusted third party or a Decentralized Exchange (DEX), a user can put up any Cardano native asset(s) for sale in exchange for any user-specified native asset(s).

This project is funded by the Cardano Treasury in [Catalyst Fund 10](https://projectcatalyst.io/funds/10/f10-developer-ecosystem-the-evolution/plug-and-play-smart-contract-api-a-game-changing-platform-to-deploy-open-source-contracts-instantly)

## Documentation

### What is Peer-to-Peer (P2P) trading?

P2P trading in the context of this project refers to the direct buying and selling of Cardano Native Tokens (both Fungible & Non-Fungible Tokens) among users, without a third party or an intermediary. This is unlike buying and selling digital assets using a Centralized Exchange (CEX), where you cannot transact directly with counterparties or a DEX where you trade against a fixed Liquidity Pool.

Trading on a CEX requires you to give custody of your tokens to them, so they can execute the trades you enter based on their charts and market order aggregators. A CEX provides access to their order book and facilitates trades and takes fees in exchange.

Depending on the type of order you use, effects such as slippage may mean you don’t get the exact price you want. P2P trading, on the other hand, gives you full control over pricing, settlement time, and whom you choose to sell to and buy from. What is even better you don't need to give custody of your assets to a centralized entity, they are locked in a contract from which you can reclaim them up until the point they are bought.

### How can this project facilitate P2P trading?

This project fulfills the cornerstone requirement of a trusted Escrow, over seeing the trade in the form of a smart contract. It locks the seller's assets in the contract until a buyer provides the required ask price or the seller wishes to cancel the offer and claim the funds back.

## Usage Example

### Install package

```sh
npm install @anastasia-labs/direct-offer-offchain
```

or

```sh
pnpm install @anastasia-labs/direct-offer-offchain
```

### Setup Lucid & Offer Scripts

```ts
// You can get the compiled scripts here: https://github.com/Anastasia-Labs/direct-offer/tree/master/compiled
import spendingValidator from "../directOfferSpending.json" assert { type : "json" };
import stakingValidator from "../directOfferStaking.json" assert { type : "json" };

export const lucid = await Lucid.new(
  new Blockfrost(
    "https://cardano-preprod.blockfrost.io/api/v0",
    "your blockfrost api key",
  ),
  "Preprod",
);

lucid.selectWalletFromPrivateKey(
  "your secret key here e.g. ed25519_...",
);

const offerScripts = {
  spending: spendingValidator.cborHex,
  staking: stakingValidator.cborHex
};
```

### Make Offer

```ts
import {
  MakeOfferConfig,
  makeOffer
} from "@anastasia-labs/direct-offer-offchain";

const makeOfferConfig: MakeOfferConfig = {
  offer: {
    ["lovelace"]: 10_000_000n
  },
  toBuy: {
    [toUnit("e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72",
    "4d494e")]: 10_000n,
  },
  scripts: offerScripts,
};

const makeOfferUnSigned = await makeOffer(lucid, makeOfferConfig);

if (makeOfferUnSigned.type == "ok") {
  const makeOfferSigned = await makeOfferUnSigned.data.sign().complete();
  const makeOfferHash = await makeOfferSigned.submit();
  await lucid.awaitTx(makeOfferHash);
  console.log(`Made offer: ${makeOfferHash}`)
}
```

### Fetch Offer

```ts
import {
  FetchOfferConfig,
  getOfferUTxOs
} from "@anastasia-labs/direct-offer-offchain";

const offerConfig: FetchOfferConfig = {
  scripts: offerScripts
};

const offers = await getOfferUTxOs(lucid, offerConfig);
console.log("Available Offers", offers);
```

### Accept Offer

```ts
import {
  AcceptOfferConfig,
  acceptOffer
} from "@anastasia-labs/direct-offer-offchain";

const acceptOfferConfig: AcceptOfferConfig = {
  offerOutRef: offers[0].outRef,
  scripts: offerScripts
};

const acceptOfferUnsigned = await acceptOffer(lucid, acceptOfferConfig);

if (acceptOfferUnsigned.type == "ok"){
  const acceptOfferSigned = await acceptOfferUnsigned.data
  .sign()
  .complete();
  const acceptOfferSignedHash = await acceptOfferSigned.submit();
  await lucid.awaitTx(acceptOfferSignedHash);
  console.log(`Accepted offer: ${acceptOfferSignedHash}`)
}
```

## Licenses

© 2023 Anastasia Labs.

All code is licensed under MIT License. See [LICENSE](./LICENSE) file
for details.
