import {
  Data,
  LucidEvolution,
  TxSignBuilder,
  Constr,
  paymentCredentialOf} from "@lucid-evolution/lucid";
import { parseSafeDatum, getOfferValidators } from "../core/utils/index.js";
import { Result, CancelOfferConfig } from "../core/types.js";
import { OfferDatum } from "../core/contract.types.js";


export const cancelOffer = async (
  lucid: LucidEvolution,
  config: CancelOfferConfig
): Promise<Result<TxSignBuilder>> => {
  const validators = getOfferValidators(lucid, config.scripts);
  
  const offerUTxO = (await lucid.utxosByOutRef([config.offerOutRef]))[0];

  if (!offerUTxO)
    return { type: "error", error: new Error("No UTxO with that TxOutRef") };

  if (!offerUTxO.datum)
    return { type: "error", error: new Error("Missing Datum") };

  const datum = parseSafeDatum(offerUTxO.datum, OfferDatum);
  if (datum.type == "left")
    return { type: "error", error: new Error(datum.value) };

  const ownAddress = await lucid.wallet().address();
  const ownHash = paymentCredentialOf(ownAddress).hash;

  const correctUTxO = "PublicKeyCredential" in datum.value.creator.paymentCredential 
    && (datum.value.creator.paymentCredential.PublicKeyCredential[0] == ownHash)
  if (!correctUTxO) 
    return { type: "error", error: new Error("Signer is not authorized to cancel offer") };

  try {
    const PReclaimRedeemer = Data.to(new Constr(1, []));

    const tx = await lucid.newTx()
      .collectFrom([offerUTxO], PReclaimRedeemer)
      .addSigner(ownAddress)
      .attach.SpendingValidator(validators.directOfferVal)
      .complete();
    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}
