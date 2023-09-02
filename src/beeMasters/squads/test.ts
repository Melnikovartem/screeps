import { setups } from "bees/creepSetups";
import { FormationPositions, SquadMaster } from "./squad";

const TEST_SUBJECT_ONE = setups.puppet.copy();
TEST_SUBJECT_ONE.patternLimit = 1;
TEST_SUBJECT_ONE.pattern = [RANGED_ATTACK];
TEST_SUBJECT_ONE.name = "test bee one";

const TEST_SUBJECT_TWO = setups.puppet.copy();
TEST_SUBJECT_TWO.patternLimit = 1;
TEST_SUBJECT_TWO.pattern = [HEAL];
TEST_SUBJECT_TWO.name = "test bee two";

export class TestSquad extends SquadMaster {
  // #region Properties (2)

  public boosts = [];
  public formation: FormationPositions = [
    [{ x: 0, y: 0 }, TEST_SUBJECT_ONE],
    [{ x: 1, y: 0 }, TEST_SUBJECT_ONE],
    [{ x: 0, y: 1 }, TEST_SUBJECT_TWO],
    [{ x: 1, y: 1 }, TEST_SUBJECT_TWO],
  ];

  // #endregion Properties (2)

  // #region Public Accessors (1)

  public get emergency() {
    return true;
  }

  // #endregion Public Accessors (1)
}
