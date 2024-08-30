import { LucidEvolution, UTxO } from "@lucid-evolution/lucid";
import {
  parseSafeDatum,
  toAddress,
  getOfferValidators,
} from "../core/utils/index.js";
import {
  ReadableUTxO,
  FetchOfferConfig,
  FetchUserOfferConfig,
} from "../core/types.js";
import { OfferDatum } from "../core/contract.types.js";

export const getOfferUTxOs = async (
  lucid: LucidEvolution,
  config: FetchOfferConfig
): Promise<ReadableUTxO<OfferDatum>[]> => {
  const validators = getOfferValidators(lucid, config.scripts);

  const offerUTxOs: UTxO[] = await lucid.utxosAt(
    validators.directOfferValAddress
  );

  return offerUTxOs.flatMap((utxo) => {
    const result = parseSafeDatum<OfferDatum>(utxo.datum, OfferDatum);

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
};

export const userOfferUTxOs = async (
  lucid: LucidEvolution,
  config: FetchUserOfferConfig
): Promise<ReadableUTxO<OfferDatum>[]> => {
  const validators = getOfferValidators(lucid, config.scripts);

  const offerUTxOs: UTxO[] = await lucid.utxosAt(
    validators.directOfferValAddress
  );

  return offerUTxOs.flatMap((utxo) => {
    const result = parseSafeDatum<OfferDatum>(utxo.datum, OfferDatum);

    if (result.type == "right") {
      const offerCreator = toAddress(
        result.value.creator,
        lucid.config().network
      );

      if (offerCreator == config.creator) {
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
    } else {
      return [];
    }
  });
};
