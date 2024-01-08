import {
  Data,
  Lucid,
  TxComplete,
  Constr,
  paymentCredentialOf,
  Assets,
  addAssets
} from "@anastasia-labs/lucid-cardano-fork";
import { parseSafeDatum, toAddress, toAssets, selectUtxos, getInputUtxoIndices, sumUtxoAssets, remove, getOfferValidators } from "../core/utils/index.js";
import { Result, AcceptOfferConfig } from "../core/types.js";
import { OfferDatum } from "../core/contract.types.js";

export const acceptOffer = async (
  lucid: Lucid,
  config: AcceptOfferConfig
): Promise<Result<TxComplete>> => {
  const validators = getOfferValidators(lucid, config.scripts);
  
  const offerUTxO = (await lucid.utxosByOutRef([config.offerOutRef]))[0];

  if (!offerUTxO)
    return { type: "error", error: new Error("No UTxO with that TxOutRef") };

  if (!offerUTxO.datum)
    return { type: "error", error: new Error("Missing Datum") };

  const datum = parseSafeDatum(lucid, offerUTxO.datum, OfferDatum);
  if (datum.type == "left")
    return { type: "error", error: new Error(datum.value) };

  const ownAddress = await lucid.wallet.address();
  const ownHash = paymentCredentialOf(ownAddress).hash;

  const correctUTxO = "PublicKeyCredential" in datum.value.creator.paymentCredential 
    && (datum.value.creator.paymentCredential.PublicKeyCredential[0] == ownHash)
  if (!correctUTxO) 
    return { type: "error", error: new Error("Signer not authorized to spend UTxO.") };

  const toBuy = toAssets(datum.value.toBuy);
  const walletUTxOs = await lucid.wallet.getUtxos();

  // initialize with clone of toBuy
  const requiredAssets: Assets = { ...toBuy } 
  // adding 4 ADA to cover minADA costs and tx fees as we will do the coin selection
  // using more than sufficient ADA to safeguard against large minADA costs
  requiredAssets["lovelace"] += 4_000_000n;

  const selectedUtxos = selectUtxos(walletUTxOs, requiredAssets);
  if(selectedUtxos.type == "error")
    return selectedUtxos
  const inputIndices = getInputUtxoIndices([offerUTxO], selectedUtxos.data);

  const offerOutputIndex = 0n;
  
  const PExecuteOfferRedeemer = Data.to(new Constr(0, []));
  const PGlobalRedeemer = Data.to(new Constr(0, [inputIndices, [offerOutputIndex]]));

  // balance the native assets from wallet inputs
  const walletAssets = sumUtxoAssets(selectedUtxos.data);
  delete walletAssets["lovelace"]; // we would want lucid to balance ADA for the tx
  const balanceAssets = remove(walletAssets, toBuy);

  try {
    const tx = await lucid.newTx()
      .collectFrom([offerUTxO], PExecuteOfferRedeemer)
      .collectFrom(selectedUtxos.data)                  // spend selected wallet utxos as inputs
      .payToAddress(toAddress(datum.value.creator, lucid), toBuy)
      .payToAddress(ownAddress, addAssets(offerUTxO.assets, balanceAssets))                 
      .withdraw(validators.rewardAddress, 0n, PGlobalRedeemer)
      .attachSpendingValidator(validators.directOfferVal)
      .attachWithdrawalValidator(validators.stakingVal)
      .complete();

    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}