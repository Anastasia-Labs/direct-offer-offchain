import {
  Data,
  Lucid,
  TxComplete,
  Address} from "@anastasia-labs/lucid-cardano-fork";
import { fromAddress, fromAssets, getOfferValidators } from "../core/utils/index.js";
import { MakeOfferConfig, Result } from "../core/types.js";
import { OfferDatum, Value } from "../core/contract.types.js";

export const makeOffer = async (
  lucid: Lucid,
  config: MakeOfferConfig
): Promise<Result<TxComplete>> => {
  const validators = getOfferValidators(lucid, config.scripts);

  const toBuyValue : Value = fromAssets(config.toBuy)
  const ownAddress : Address = await lucid.wallet.address()
  const currOffer : OfferDatum = {
    creator: fromAddress(ownAddress),
    toBuy: toBuyValue
  }

  const directDatum =  Data.to<OfferDatum>(currOffer, OfferDatum)

  try {
    const tx = await lucid.newTx()
        .payToContract(validators.directOfferValAddress, {inline: directDatum}, config.offer)
        .complete();

    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}