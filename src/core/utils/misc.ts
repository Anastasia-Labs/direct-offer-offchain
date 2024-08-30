import {
  Constr,
  LucidEvolution,
  SpendingValidator,
  WithdrawalValidator,
  applyParamsToScript,
  validatorToAddress,
  validatorToRewardAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { CborHex, OfferValidators } from "../types.js";

export const getOfferValidators = (
  lucid: LucidEvolution,
  scripts: { spending: CborHex; staking: CborHex }
): OfferValidators => {
  const stakingVal: WithdrawalValidator = {
    type: "PlutusV2",
    script: scripts.staking,
  };

  const network = lucid.config().network;
  const rewardAddress = validatorToRewardAddress(network, stakingVal);
  const stakingCred = new Constr(0, [
    new Constr(1, [validatorToScriptHash(stakingVal)]),
  ]);

  const directOfferVal: SpendingValidator = {
    type: "PlutusV2",
    script: applyParamsToScript(scripts.spending, [stakingCred]),
  };
  const directOfferValAddress = validatorToAddress(network, directOfferVal);

  return {
    directOfferVal: directOfferVal,
    directOfferValAddress: directOfferValAddress,
    stakingVal: stakingVal,
    rewardAddress: rewardAddress,
  };
};
