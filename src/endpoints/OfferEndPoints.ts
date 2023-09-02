import {
  Data,
  Lucid,
  SpendingValidator,
  toUnit,
  TxComplete,
  applyParamsToScript,
  Credential,
  UTxO,
  Address,
  fromText,
  OutRef,
  Constr,
  paymentCredentialOf,
  Assets
} from "@anastasia-labs/lucid-cardano-fork";
import { divCeil, parseSafeDatum, fromAddress, toAddress, utxosAtScript, fromAssets, toAssets, union } from "../core/utils/utils.js";
import { ReadableUTxO, Result } from "../core/types.js";
import { OfferDatum, Value } from "../core/contract.types.js";

const addressesFromAsset = async (assetClass: string) : Promise<string[]> => {
  const addressesWithAsset = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/assets/${assetClass}/addresses`, {
    headers: { project_id: "preprodLT9nUTb22P26FiVH42jSFJU2IZaNxZVz" },
  }).then((r) => r.json())
  return addressesWithAsset.map((entry: { address: string; quantity: string; }) => entry.address)
}
const utxosWithAsset = async (lucid: Lucid, assetClass: string) : Promise<UTxO[]> => {
  const addressesWithAsset = await addressesFromAsset(assetClass)
  return addressesWithAsset.reduce(async (acc: Promise<UTxO[]>, address: string) => {
    const results = await lucid.utxosAtWithUnit(address, assetClass);
    return (await acc).concat(results);
  }, Promise.resolve([]))
}

export const getOfferUTxOs = async(lucid: Lucid, creator: Credential): Promise<ReadableUTxO<OfferDatum>[]> => {
  const directOfferCbor = "590356590353010000323232323232323232323232323232323232322222323232323232323253330183370e900100109919299980d191919299980e99b87480000084c8c94cc054c8cc0548cc0588cdc49bad302900133301a004375c604a0046eb8c094004dd598140008009bab3024302300f15330153370e66603a444a666042002200426600666e000092002302600148000cc0688cdd7991813181380098129812181300098128041bac302400d480084cdc399980b9bab302400b375c026646464a66604466e1d2002002161375c604e002605000460460026ea8c8c094c098004c09003cc8cdc0a400000290011bab30233022302400132533301d001153302049010e4c69737420697320656d7074792e0016132533301e0011302400215330214901244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e00163022001330183223302000230243025001302200d004132323253330203370e90000010999180f9129998110008a50153330233375e605000200629444c008c09c004c094004dd618129918129812981280098120060a503026002302100137546460466048002604401a6046004603c0026ea8030526163758603c00c603c66446603044a6660360022c264a66603a6603c0086044002260446042002260066042004604460420020046eb0c074018c07400454cc069241605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3139303a352d34320016301e002301900137546034603200860306030002602e602e0026030602e002602e004602c0064601444a66601a002294454cc010c00cc04c0044c008c04800488ccc03000800400c5281111999802001240004666600a00490003ad3756002006460046ea40048888cc020894ccc02c004401454ccc030cdd798079808800803098021809980880089801180800080091802112999803800880209929998049802000899803000980198068010980198068011806800a5eb815d0119180111980100100091801119801001000aab9f57344466ebcdd398038011ba730070015738aae755d12ba1230023754002aae781"
  const offerBeaconCbor = "59019a59019701000032323232323232323232323232223232323253330073370e9000001099192999804991919299980619b8748008008528899b8f375c6028601a646646460044660040040024600446600400400244a6660240022c2a66601e66ebcc05cc0600040204dd5980d980c00089801180c8008009bab3015004375c601a6eb0c054c044c058010c05c008c048004dd50040a4c2c646026601c0026026602200a60200022a6601c921605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3136353a352d313900163012002300d0013754601a601c002601c002ae6894ccc00c00454cc01c008584c94ccc0100044c02800854cc02001458c0280052410e4c69737420697320656d7074792e005573e921244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e002300630020012300530050015738aae755d0aba2230023754002aae781"
  const OfferBeaconMP : SpendingValidator = {
    type: "PlutusV2",
    script: offerBeaconCbor, 
  }
  const offerPolicyId = lucid.utils.mintingPolicyToId(OfferBeaconMP)
  const DirectOfferValidator : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(directOfferCbor, [offerPolicyId]), 
  }
  const directValAddress = lucid.utils.validatorToAddress(DirectOfferValidator);
  const offerUTxOs : UTxO[] = await lucid.utxosAt(directValAddress)
  return offerUTxOs.flatMap((utxo) => {
    const result = parseSafeDatum<OfferDatum>(lucid, utxo.datum, OfferDatum);
    if (result.type == "right") {
      return {
        outRef: {
          txHash: utxo.txHash,
          outputIndex: utxo.outputIndex,
        },
        datum: result.value,
        assets: utxo.assets,
      };
    } else {
      return [];
    }
  });
}

export const userOfferUTxOs = async(lucid: Lucid, creator: Credential): Promise<ReadableUTxO<OfferDatum>[]> => {
  const directOfferCbor = "590356590353010000323232323232323232323232323232323232322222323232323232323253330183370e900100109919299980d191919299980e99b87480000084c8c94cc054c8cc0548cc0588cdc49bad302900133301a004375c604a0046eb8c094004dd598140008009bab3024302300f15330153370e66603a444a666042002200426600666e000092002302600148000cc0688cdd7991813181380098129812181300098128041bac302400d480084cdc399980b9bab302400b375c026646464a66604466e1d2002002161375c604e002605000460460026ea8c8c094c098004c09003cc8cdc0a400000290011bab30233022302400132533301d001153302049010e4c69737420697320656d7074792e0016132533301e0011302400215330214901244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e00163022001330183223302000230243025001302200d004132323253330203370e90000010999180f9129998110008a50153330233375e605000200629444c008c09c004c094004dd618129918129812981280098120060a503026002302100137546460466048002604401a6046004603c0026ea8030526163758603c00c603c66446603044a6660360022c264a66603a6603c0086044002260446042002260066042004604460420020046eb0c074018c07400454cc069241605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3139303a352d34320016301e002301900137546034603200860306030002602e602e0026030602e002602e004602c0064601444a66601a002294454cc010c00cc04c0044c008c04800488ccc03000800400c5281111999802001240004666600a00490003ad3756002006460046ea40048888cc020894ccc02c004401454ccc030cdd798079808800803098021809980880089801180800080091802112999803800880209929998049802000899803000980198068010980198068011806800a5eb815d0119180111980100100091801119801001000aab9f57344466ebcdd398038011ba730070015738aae755d12ba1230023754002aae781"
  const offerBeaconCbor = "59019a59019701000032323232323232323232323232223232323253330073370e9000001099192999804991919299980619b8748008008528899b8f375c6028601a646646460044660040040024600446600400400244a6660240022c2a66601e66ebcc05cc0600040204dd5980d980c00089801180c8008009bab3015004375c601a6eb0c054c044c058010c05c008c048004dd50040a4c2c646026601c0026026602200a60200022a6601c921605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3136353a352d313900163012002300d0013754601a601c002601c002ae6894ccc00c00454cc01c008584c94ccc0100044c02800854cc02001458c0280052410e4c69737420697320656d7074792e005573e921244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e002300630020012300530050015738aae755d0aba2230023754002aae781"
  const OfferBeaconMP : SpendingValidator = {
    type: "PlutusV2",
    script: offerBeaconCbor, 
  }
  const offerPolicyId = lucid.utils.mintingPolicyToId(OfferBeaconMP)
  const DirectOfferValidator : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(directOfferCbor, [offerPolicyId]), 
  }
  const directValAddress = lucid.utils.validatorToAddress(DirectOfferValidator);
  const offerUnit = toUnit(offerPolicyId, fromText(creator.hash))
  const offerUTxOs : UTxO[] = await lucid.utxosAtWithUnit(directValAddress, offerUnit)
  return offerUTxOs.flatMap((utxo) => {
    const result = parseSafeDatum<OfferDatum>(lucid, utxo.datum, OfferDatum);
    if (result.type == "right") {
      return {
        outRef: {
          txHash: utxo.txHash,
          outputIndex: utxo.outputIndex,
        },
        datum: result.value,
        assets: utxo.assets,
      };
    } else {
      return [];
    }
  });
}

export const cancelOffer = async (
  lucid: Lucid,
  offerOutRef: OutRef
): Promise<Result<TxComplete>> => {
  const directOfferCbor = "590356590353010000323232323232323232323232323232323232322222323232323232323253330183370e900100109919299980d191919299980e99b87480000084c8c94cc054c8cc0548cc0588cdc49bad302900133301a004375c604a0046eb8c094004dd598140008009bab3024302300f15330153370e66603a444a666042002200426600666e000092002302600148000cc0688cdd7991813181380098129812181300098128041bac302400d480084cdc399980b9bab302400b375c026646464a66604466e1d2002002161375c604e002605000460460026ea8c8c094c098004c09003cc8cdc0a400000290011bab30233022302400132533301d001153302049010e4c69737420697320656d7074792e0016132533301e0011302400215330214901244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e00163022001330183223302000230243025001302200d004132323253330203370e90000010999180f9129998110008a50153330233375e605000200629444c008c09c004c094004dd618129918129812981280098120060a503026002302100137546460466048002604401a6046004603c0026ea8030526163758603c00c603c66446603044a6660360022c264a66603a6603c0086044002260446042002260066042004604460420020046eb0c074018c07400454cc069241605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3139303a352d34320016301e002301900137546034603200860306030002602e602e0026030602e002602e004602c0064601444a66601a002294454cc010c00cc04c0044c008c04800488ccc03000800400c5281111999802001240004666600a00490003ad3756002006460046ea40048888cc020894ccc02c004401454ccc030cdd798079808800803098021809980880089801180800080091802112999803800880209929998049802000899803000980198068010980198068011806800a5eb815d0119180111980100100091801119801001000aab9f57344466ebcdd398038011ba730070015738aae755d12ba1230023754002aae781"
  const offerBeaconCbor = "59019a59019701000032323232323232323232323232223232323253330073370e9000001099192999804991919299980619b8748008008528899b8f375c6028601a646646460044660040040024600446600400400244a6660240022c2a66601e66ebcc05cc0600040204dd5980d980c00089801180c8008009bab3015004375c601a6eb0c054c044c058010c05c008c048004dd50040a4c2c646026601c0026026602200a60200022a6601c921605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3136353a352d313900163012002300d0013754601a601c002601c002ae6894ccc00c00454cc01c008584c94ccc0100044c02800854cc02001458c0280052410e4c69737420697320656d7074792e005573e921244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e002300630020012300530050015738aae755d0aba2230023754002aae781"
  const OfferBeaconMP : SpendingValidator = {
    type: "PlutusV2",
    script: offerBeaconCbor, 
  }
  const offerPolicyId = lucid.utils.mintingPolicyToId(OfferBeaconMP)
  const DirectOfferValidator : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(directOfferCbor, [offerPolicyId]), 
  }
  const directValAddress = lucid.utils.validatorToAddress(DirectOfferValidator);
  
  const offerUTxO = (await lucid.utxosByOutRef([offerOutRef]))[0];

  if (!offerUTxO)
    return { type: "error", error: new Error("No UTxO with that TxOutRef") };

  if (!offerUTxO.datum)
    return { type: "error", error: new Error("Missing Datum") };

  const datum = parseSafeDatum(lucid, offerUTxO.datum, OfferDatum);
  if (datum.type == "left")
    return { type: "error", error: new Error(datum.value) };

  const ownHash = paymentCredentialOf(await lucid.wallet.address()).hash
  const offerUnit = toUnit(offerPolicyId, fromText(ownHash))  

  const correctUTxO = "PublicKeyCredential" in datum.value.creator.paymentCredential 
    && (datum.value.creator.paymentCredential.PublicKeyCredential[0] == ownHash)
  if (!correctUTxO) 
    return { type: "error", error: new Error("Signer not authorized to spend UTxO.") };

  try {
    const PCancelOfferRedeemer = Data.to(new Constr(2, []))
    const tx = await lucid.newTx()
      .mintAssets({[offerUnit]: -1n})
      .collectFrom([offerUTxO], PCancelOfferRedeemer)
      .addSignerKey(ownHash)
      .attachMintingPolicy(OfferBeaconMP)
      .attachSpendingValidator(DirectOfferValidator)
      .complete();
    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}


export const makeOffer = async (
  lucid: Lucid,
  offer: Assets,
  toBuy: Assets
): Promise<Result<TxComplete>> => {
  const directOfferCbor = "590356590353010000323232323232323232323232323232323232322222323232323232323253330183370e900100109919299980d191919299980e99b87480000084c8c94cc054c8cc0548cc0588cdc49bad302900133301a004375c604a0046eb8c094004dd598140008009bab3024302300f15330153370e66603a444a666042002200426600666e000092002302600148000cc0688cdd7991813181380098129812181300098128041bac302400d480084cdc399980b9bab302400b375c026646464a66604466e1d2002002161375c604e002605000460460026ea8c8c094c098004c09003cc8cdc0a400000290011bab30233022302400132533301d001153302049010e4c69737420697320656d7074792e0016132533301e0011302400215330214901244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e00163022001330183223302000230243025001302200d004132323253330203370e90000010999180f9129998110008a50153330233375e605000200629444c008c09c004c094004dd618129918129812981280098120060a503026002302100137546460466048002604401a6046004603c0026ea8030526163758603c00c603c66446603044a6660360022c264a66603a6603c0086044002260446042002260066042004604460420020046eb0c074018c07400454cc069241605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3139303a352d34320016301e002301900137546034603200860306030002602e602e0026030602e002602e004602c0064601444a66601a002294454cc010c00cc04c0044c008c04800488ccc03000800400c5281111999802001240004666600a00490003ad3756002006460046ea40048888cc020894ccc02c004401454ccc030cdd798079808800803098021809980880089801180800080091802112999803800880209929998049802000899803000980198068010980198068011806800a5eb815d0119180111980100100091801119801001000aab9f57344466ebcdd398038011ba730070015738aae755d12ba1230023754002aae781"
  const offerBeaconCbor = "59019a59019701000032323232323232323232323232223232323253330073370e9000001099192999804991919299980619b8748008008528899b8f375c6028601a646646460044660040040024600446600400400244a6660240022c2a66601e66ebcc05cc0600040204dd5980d980c00089801180c8008009bab3015004375c601a6eb0c054c044c058010c05c008c048004dd50040a4c2c646026601c0026026602200a60200022a6601c921605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3136353a352d313900163012002300d0013754601a601c002601c002ae6894ccc00c00454cc01c008584c94ccc0100044c02800854cc02001458c0280052410e4c69737420697320656d7074792e005573e921244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e002300630020012300530050015738aae755d0aba2230023754002aae781"
  const OfferBeaconMP : SpendingValidator = {
    type: "PlutusV2",
    script: offerBeaconCbor, 
  }
  const offerPolicyId = lucid.utils.mintingPolicyToId(OfferBeaconMP)
  const DirectOfferValidator : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(directOfferCbor, [offerPolicyId]), 
  }
  const directValAddress = lucid.utils.validatorToAddress(DirectOfferValidator);
  const toBuyValue : Value = fromAssets(toBuy)
  const ownAddress : Address = await lucid.wallet.address()
  const currOffer : OfferDatum = {
    creator: fromAddress(ownAddress),
    toBuy: toBuyValue
  }

  const ownHash = paymentCredentialOf(await lucid.wallet.address()).hash
  const offerUnit = toUnit(offerPolicyId, fromText(ownHash))

  const directDatum =  Data.to<OfferDatum>(currOffer, OfferDatum)
  try {
    const tx = await lucid.newTx()
        .mintAssets({[offerUnit]: 1n})
        .payToContract(directValAddress, {inline: directDatum}, union(offer, {[offerUnit]: 1n}))
        .attachMintingPolicy(OfferBeaconMP)
        .complete();
    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}

export const acceptOffer = async (
  lucid: Lucid,
  offerOutRef: OutRef
): Promise<Result<TxComplete>> => {
  const directOfferCbor = "590356590353010000323232323232323232323232323232323232322222323232323232323253330183370e900100109919299980d191919299980e99b87480000084c8c94cc054c8cc0548cc0588cdc49bad302900133301a004375c604a0046eb8c094004dd598140008009bab3024302300f15330153370e66603a444a666042002200426600666e000092002302600148000cc0688cdd7991813181380098129812181300098128041bac302400d480084cdc399980b9bab302400b375c026646464a66604466e1d2002002161375c604e002605000460460026ea8c8c094c098004c09003cc8cdc0a400000290011bab30233022302400132533301d001153302049010e4c69737420697320656d7074792e0016132533301e0011302400215330214901244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e00163022001330183223302000230243025001302200d004132323253330203370e90000010999180f9129998110008a50153330233375e605000200629444c008c09c004c094004dd618129918129812981280098120060a503026002302100137546460466048002604401a6046004603c0026ea8030526163758603c00c603c66446603044a6660360022c264a66603a6603c0086044002260446042002260066042004604460420020046eb0c074018c07400454cc069241605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3139303a352d34320016301e002301900137546034603200860306030002602e602e0026030602e002602e004602c0064601444a66601a002294454cc010c00cc04c0044c008c04800488ccc03000800400c5281111999802001240004666600a00490003ad3756002006460046ea40048888cc020894ccc02c004401454ccc030cdd798079808800803098021809980880089801180800080091802112999803800880209929998049802000899803000980198068010980198068011806800a5eb815d0119180111980100100091801119801001000aab9f57344466ebcdd398038011ba730070015738aae755d12ba1230023754002aae781"
  const offerBeaconCbor = "59019a59019701000032323232323232323232323232223232323253330073370e9000001099192999804991919299980619b8748008008528899b8f375c6028601a646646460044660040040024600446600400400244a6660240022c2a66601e66ebcc05cc0600040204dd5980d980c00089801180c8008009bab3015004375c601a6eb0c054c044c058010c05c008c048004dd50040a4c2c646026601c0026026602200a60200022a6601c921605061747465726e206d61746368206661696c75726520696e2027646f2720626c6f636b206174207372632f56756c63616e2f4f6e636861696e2f436f6c6c656374696f6e732f4469726563745472616e736665722e68733a3136353a352d313900163012002300d0013754601a601c002601c002ae6894ccc00c00454cc01c008584c94ccc0100044c02800854cc02001458c0280052410e4c69737420697320656d7074792e005573e921244c69737420636f6e7461696e73206d6f7265207468616e206f6e6520656c656d656e742e002300630020012300530050015738aae755d0aba2230023754002aae781"
  const OfferBeaconMP : SpendingValidator = {
    type: "PlutusV2",
    script: offerBeaconCbor, 
  }
  const offerPolicyId = lucid.utils.mintingPolicyToId(OfferBeaconMP)
  const DirectOfferValidator : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(directOfferCbor, [offerPolicyId]), 
  }
  const directValAddress = lucid.utils.validatorToAddress(DirectOfferValidator);
  
  const offerUTxO = (await lucid.utxosByOutRef([offerOutRef]))[0];

  if (!offerUTxO)
    return { type: "error", error: new Error("No UTxO with that TxOutRef") };

  if (!offerUTxO.datum)
    return { type: "error", error: new Error("Missing Datum") };

  const datum = parseSafeDatum(lucid, offerUTxO.datum, OfferDatum);
  if (datum.type == "left")
    return { type: "error", error: new Error(datum.value) };

  const ownHash = paymentCredentialOf(await lucid.wallet.address()).hash
  const offerUnit = toUnit(offerPolicyId, fromText(ownHash))  

  const correctUTxO = "PublicKeyCredential" in datum.value.creator.paymentCredential 
    && (datum.value.creator.paymentCredential.PublicKeyCredential[0] == ownHash)
  if (!correctUTxO) 
    return { type: "error", error: new Error("Signer not authorized to spend UTxO.") };

  try {
    const PAcceptOfferRedeemer = Data.to(new Constr(0, []))
    const tx = await lucid.newTx()
      .mintAssets({[offerUnit]: -1n})
      .collectFrom([offerUTxO], PAcceptOfferRedeemer)
      .payToAddress(toAddress(datum.value.creator, lucid), toAssets(datum.value.toBuy))
      .attachMintingPolicy(OfferBeaconMP)
      .attachSpendingValidator(DirectOfferValidator)
      .complete();
    return { type: "ok", data: tx };  
  } catch (error) {
    if (error instanceof Error) return { type: "error", error: error };
    return { type: "error", error: new Error(`${JSON.stringify(error)}`) };
  }
}