import { Address, Assets, OutRef, Script, UTxO } from "@lucid-evolution/lucid";
import { Value } from "./contract.types.js";

export type CborHex = string;
export type RawHex = string;
export type POSIXTime = number;

export type Result<T> =
  | { type: "ok"; data: T }
  | { type: "error"; error: Error };

export type Either<L, R> =
  | { type: "left"; value: L }
  | { type: "right"; value: R };

export type AssetClass = {
  policyId: string;
  tokenName: string;
};

export type FetchOfferConfig = {
  scripts : {
    spending: CborHex;
    staking: CborHex;
  }
}

export type FetchUserOfferConfig = {
  creator : Address;
  scripts : {
    spending: CborHex;
    staking: CborHex;
  }
}

export type MakeOfferConfig = {
  offer : Assets;
  toBuy : Assets;
  scripts : {
    spending: CborHex;
    staking: CborHex;
  }
}

export type CancelOfferConfig = {
  offerOutRef : OutRef;
  scripts : {
    spending: CborHex;
    staking: CborHex;
  }
}

export type AcceptOfferConfig = {
  offerOutRef : OutRef;
  scripts : {
    spending: CborHex;
    staking: CborHex;
  }
}

export type OfferValidators = {
  directOfferVal : Script;
  directOfferValAddress : Address;
  stakingVal : Script;
  rewardAddress: Address;
}

export type ReadableUTxO<T> = {
  outRef: OutRef;
  datum: T;
  assets: Assets;
};

export type OfferInfo = {
  creator: Address,
  toBuy: Value, 
  offer: Value 
  offerUTxO: UTxO
};
