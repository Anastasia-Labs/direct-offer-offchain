import { Constr, Lucid, SpendingValidator, WithdrawalValidator, applyParamsToScript } from "@anastasia-labs/lucid-cardano-fork";
import { CborHex, OfferValidators } from "../types.js";
import { applyParamsToScript as leApply, Constr as LEConstr } from "@lucid-evolution/lucid";

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

  const lucidCBOR = applyParamsToScript(scripts.spending, [stakingCred]);

  console.log("======================= LUCID =======================");
  console.log(lucidCBOR);
  console.log("=====================================================");
  console.log();

  const leStakingCred = new LEConstr(0, 
    [new LEConstr(1, [lucid.utils.validatorToScriptHash(stakingVal)])]);
  const leCBOR = leApply(scripts.spending, [leStakingCred]);

  console.log("=================== LUCID EVOLUTION =================");
  console.log(leCBOR);
  console.log("=====================================================");


  const directOfferVal : SpendingValidator = {
    type: "PlutusV2",
    script: lucidCBOR,
  }
  const directOfferValAddress = lucid.utils.validatorToAddress(directOfferVal);
  
  return {
    directOfferVal: directOfferVal,
    directOfferValAddress: directOfferValAddress,
    stakingVal: stakingVal,
    rewardAddress: rewardAddress
  }
}
