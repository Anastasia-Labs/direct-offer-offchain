import { Constr, Lucid, SpendingValidator, WithdrawalValidator, applyParamsToScript } from "@anastasia-labs/lucid-cardano-fork";
import { CborHex, OfferValidators } from "../types.js";

export const getOfferValidators = (
  lucid: Lucid,
  scripts: { spending: CborHex, staking: CborHex}
): OfferValidators => {
  const stakingVal : WithdrawalValidator = {
    type: "PlutusV2",
    script: scripts.staking
  }

  const rewardAddress = lucid.utils.validatorToRewardAddress(stakingVal);
  const stakingCred = new Constr(0, 
    [new Constr(1, [lucid.utils.validatorToScriptHash(stakingVal)])]);

  const directOfferVal : SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(scripts.spending, [stakingCred]),
  }
  const directOfferValAddress = lucid.utils.validatorToAddress(directOfferVal);
  
  return {
    directOfferVal: directOfferVal,
    directOfferValAddress: directOfferValAddress,
    stakingVal: stakingVal,
    rewardAddress: rewardAddress
  }
}