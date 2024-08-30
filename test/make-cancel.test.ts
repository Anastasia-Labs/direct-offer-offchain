import {
  Emulator,
  generateEmulatorAccount,
  userOfferUTxOs,
  makeOffer,
  cancelOffer,
  FetchUserOfferConfig,
  MakeOfferConfig,
  CancelOfferConfig,
  Lucid,
  toUnit,
  LucidEvolution,
} from "../src/index.js";
import { beforeEach, expect, test } from "vitest";
import spendingValidator from "./directOfferSpending.json" assert { type : "json" };
import stakingValidator from "./directOfferStaking.json" assert { type : "json" };

type LucidContext = {
  lucid: LucidEvolution;
  users: any;
  emulator: Emulator;
};

//NOTE: INITIALIZE EMULATOR + ACCOUNTS
beforeEach<LucidContext>(async (context) => {
  context.users = {
    creator1: generateEmulatorAccount({
      lovelace: BigInt(100_000_000),
    }),
    creator2: generateEmulatorAccount({
      lovelace: BigInt(100_000_000),
    }),
  };

  context.emulator = new Emulator([
    context.users.creator1,
    context.users.creator2,
  ]);

  context.lucid = await Lucid(context.emulator, "Custom");
});

test<LucidContext>("Test - Make Offer, Cancel Offer", async ({
  lucid,
  users,
  emulator,
}) => {
  const offerScripts = {
    spending: spendingValidator.cborHex,
    staking: stakingValidator.cborHex
  };

  const makeOfferConfig: MakeOfferConfig = {
    offer: {
      ["lovelace"] : BigInt(10_000_000)
    },
    toBuy: {
      [toUnit(
        "2c04fa26b36a376440b0615a7cdf1a0c2df061df89c8c055e2650505",
        "63425443"
      )]: BigInt(5),
    },
    scripts: offerScripts,
  };

  lucid.selectWallet.fromSeed(users.creator1.seedPhrase);
  emulator.awaitBlock(50);
  const x = await lucid.wallet().getUtxos();

  // NOTE: Make Offer 1
  const makeOfferUnSigned = await makeOffer(lucid, makeOfferConfig);
  // console.log("makeOfferUnSigned", makeOfferUnSigned)
  expect(makeOfferUnSigned.type).toBe("ok");
  if (makeOfferUnSigned.type == "ok") {
    // console.log(tx.data.txComplete.to_json())
    const makeOfferSigned = await makeOfferUnSigned.data.sign.withWallet().complete();
    const makeOfferHash = await makeOfferSigned.submit();
    // console.log(makeOfferHash)
  }

  emulator.awaitBlock(100);

  // NOTE: Fetch Offer 1
  const userOfferConfig: FetchUserOfferConfig = {
    creator: users.creator1.address,
    scripts: offerScripts
  };

  const userOffers1 = await userOfferUTxOs(lucid, userOfferConfig);

  // console.log("Offer 1");
  // console.log("creator1 Offers", userOffers1);
  // console.log("utxos at creator1 wallet", await lucid.utxosAt(users.creator1.address));

  const cancelOfferConfig: CancelOfferConfig = {
    offerOutRef: userOffers1[0].outRef,
    scripts: offerScripts
  };

  // NOTE: Invalid Cancel Offer 1
  lucid.selectWallet.fromSeed(users.creator2.seedPhrase);
  const invalidCancelOffer = await cancelOffer(lucid, cancelOfferConfig);

  expect(invalidCancelOffer.type).toBe("error");

  if (invalidCancelOffer.type == "ok") return;

  // console.log("Invalid Cancel Offer 1");
  // console.log(`Failed. Response: ${invalidCancelOffer.error}`);

  // NOTE: Valid Cancel Offer 1
  lucid.selectWallet.fromSeed(users.creator1.seedPhrase);
  const cancelOfferUnsigned1 = await cancelOffer(lucid, cancelOfferConfig);

  // console.log("CANCEL OFFER", cancelOfferUnsigned1);
  expect(cancelOfferUnsigned1.type).toBe("ok");

  if (cancelOfferUnsigned1.type == "error") return;
  const cancelOfferSigned1 = await cancelOfferUnsigned1.data
    .sign.withWallet()
    .complete();
  const cancelOfferSignedHash1 = await cancelOfferSigned1.submit();

  emulator.awaitBlock(100);
  
  const userOffers2 = await userOfferUTxOs(lucid, userOfferConfig);
  // console.log("Valid Cancel Offer 1");
  // console.log("creator1 Offers", userOffers2);
  // console.log("utxos at creator1 wallet", await lucid.utxosAt(users.creator1.address));
});
