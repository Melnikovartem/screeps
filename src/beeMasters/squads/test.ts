import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

const TEST_SUBJECT_ONE = setups.puppet.copy();
TEST_SUBJECT_ONE.patternLimit = 1;
TEST_SUBJECT_ONE.pattern = [RANGED_ATTACK];
TEST_SUBJECT_ONE.name = "test bee one";

const TEST_SUBJECT_TWO = setups.puppet.copy();
TEST_SUBJECT_TWO.patternLimit = 1;
TEST_SUBJECT_TWO.pattern = [HEAL];
TEST_SUBJECT_TWO.name = "test bee two";

export class TestSquad extends SquadMaster {
  boosts = [];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, TEST_SUBJECT_ONE],
    [{ x: 1, y: 0 }, TEST_SUBJECT_ONE],
    [{ x: 0, y: 1 }, TEST_SUBJECT_TWO],
    [{ x: 1, y: 1 }, TEST_SUBJECT_TWO]];

  get emergency() {
    return true;
  }
}
