import {
  Address,
  applyDoubleCborEncoding,
  Assets,
  Constr,
  Data,
  generateSeedPhrase,
  getAddressDetails,
  Lucid,
  SpendingValidator,
} from "@anastasia-labs/lucid-cardano-fork"
import { AddressD, Value } from "../contract.types.js";
import { Either, ReadableUTxO, Result } from "../types.js";

export const utxosAtScript = async (
  lucid: Lucid,
  script: string,
  stakeCredentialHash?: string
) => {
  const scriptValidator: SpendingValidator = {
    type: "PlutusV2",
    script: script,
  };

  const scriptValidatorAddr = stakeCredentialHash
    ? lucid.utils.validatorToAddress(
        scriptValidator,
        lucid.utils.keyHashToCredential(stakeCredentialHash)
      )
    : lucid.utils.validatorToAddress(scriptValidator);

  return lucid.utxosAt(scriptValidatorAddr);
};

export const parseSafeDatum = <T>(
  lucid: Lucid,
  datum: string | null | undefined,
  datumType: T
): Either<string, T> => {
  if (datum) {
    try {
      const parsedDatum = Data.from(datum, datumType);
      return {
        type: "right",
        value: parsedDatum,
      };
    } catch (error) {
      return { type: "left", value: `invalid datum : ${error}` };
    }
  } else {
    return { type: "left", value: "missing datum" };
  }
};

export const parseUTxOsAtScript = async <T>(
  lucid: Lucid,
  script: string,
  datumType: T,
  stakeCredentialHash?: string
): Promise<ReadableUTxO<T>[]> => {
  //FIX: this can throw an error if script is empty or not initialized
  const utxos = await utxosAtScript(lucid, script, stakeCredentialHash);
  return utxos.flatMap((utxo) => {
    const result = parseSafeDatum<T>(lucid, utxo.datum, datumType);
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

export const toCBORHex = (rawHex: string) => {
  return applyDoubleCborEncoding(rawHex);
};

export const generateAccountSeedPhrase = async (assets: Assets) => {
  const seedPhrase = generateSeedPhrase();
  return {
    seedPhrase,
    address: await (await Lucid.new(undefined, "Custom"))
      .selectWalletFromSeed(seedPhrase)
      .wallet.address(),
    assets,
  };
};

export function fromAddress(address: Address): AddressD {
  // We do not support pointer addresses!

  const { paymentCredential, stakeCredential } = getAddressDetails(address);

  if (!paymentCredential) throw new Error("Not a valid payment address.");

  return {
    paymentCredential:
      paymentCredential?.type === "Key"
        ? {
            PublicKeyCredential: [paymentCredential.hash],
          }
        : { ScriptCredential: [paymentCredential.hash] },
    stakeCredential: stakeCredential
      ? {
          Inline: [
            stakeCredential.type === "Key"
              ? {
                  PublicKeyCredential: [stakeCredential.hash],
                }
              : { ScriptCredential: [stakeCredential.hash] },
          ],
        }
      : null,
  };
}

export function toAddress(address: AddressD, lucid: Lucid): Address {
  const paymentCredential = (() => {
    if ("PublicKeyCredential" in address.paymentCredential) {
      return lucid.utils.keyHashToCredential(
        address.paymentCredential.PublicKeyCredential[0]
      );
    } else {
      return lucid.utils.scriptHashToCredential(
        address.paymentCredential.ScriptCredential[0]
      );
    }
  })();
  const stakeCredential = (() => {
    if (!address.stakeCredential) return undefined;
    if ("Inline" in address.stakeCredential) {
      if ("PublicKeyCredential" in address.stakeCredential.Inline[0]) {
        return lucid.utils.keyHashToCredential(
          address.stakeCredential.Inline[0].PublicKeyCredential[0]
        );
      } else {
        return lucid.utils.scriptHashToCredential(
          address.stakeCredential.Inline[0].ScriptCredential[0]
        );
      }
    } else {
      return undefined;
    }
  })();
  return lucid.utils.credentialToAddress(paymentCredential, stakeCredential);
}

export const fromAddressToData = (address: Address): Result<Data> => {
  const addrDetails = getAddressDetails(address);

  if (!addrDetails.paymentCredential)
    return { type: "error", error: new Error("undefined paymentCredential") };

  const paymentCred =
    addrDetails.paymentCredential.type == "Key"
      ? new Constr(0, [addrDetails.paymentCredential.hash])
      : new Constr(1, [addrDetails.paymentCredential.hash]);

  if (!addrDetails.stakeCredential)
    return {
      type: "ok",
      data: new Constr(0, [paymentCred, new Constr(1, [])]),
    };

  const stakingCred = new Constr(0, [
    new Constr(0, [new Constr(0, [addrDetails.stakeCredential.hash])]),
  ]);

  return { type: "ok", data: new Constr(0, [paymentCred, stakingCred]) };
};

export const chunkArray = <T>(array: T[], chunkSize: number) => {
  const numberOfChunks = Math.ceil(array.length / chunkSize);

  return [...Array(numberOfChunks)].map((value, index) => {
    return array.slice(index * chunkSize, (index + 1) * chunkSize);
  });
};

export const replacer = (key: unknown, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

export const divCeil = (a: bigint, b: bigint) => {
  return 1n + (a - 1n) / b;
};

export function union (
  a1: Assets,
  a2: Assets
) {
  const a2Entries = Object.entries(a2);

  // initialize with clone of a1
  const result: Assets = { ...a1 };

  // add or append entries from a2
  a2Entries.forEach(([key, quantity]) => {
      if (result[key]) {
          result[key] += quantity;
      } else {
          result[key] = quantity;
      }
  });

  return result;
}

export function fromAssets(assets: Assets): Value {
  const value = new Map<string, Map<string, bigint>>();
  if (assets.lovelace) value.set("", new Map([["", assets.lovelace]]));

  const units = Object.keys(assets);
  const policies = Array.from(
      new Set(
      units
          .filter((unit) => unit !== "lovelace")
          .map((unit) => unit.slice(0, 56)),
      ),
  );
  policies.sort().forEach((policyId) => {
      const policyUnits = units.filter((unit) => unit.slice(0, 56) === policyId);
      const assetsMap = new Map<string, bigint>();
      policyUnits.sort().forEach((unit) => {
          assetsMap.set(
              unit.slice(56),
              assets[unit],
          );
      });
      value.set(policyId, assetsMap);
  });
  return value;
}

export function toAssets(value: Value): Assets {
  const result: Assets = { lovelace: value.get("")?.get("") || BigInt(0) };

  for (const [policyId, assets] of value) {
      if (policyId === "") continue;
      for (const [assetName, amount] of assets) {
      result[policyId + assetName] = amount;
      }
  }
  return result;
}