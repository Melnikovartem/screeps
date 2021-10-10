import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

export class TestSquad extends SquadMaster {
  boosts = [];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, setups.puppet],
    [{ x: 1, y: 0 }, setups.puppet],
    [{ x: 0, y: 1 }, setups.puppet],
    [{ x: 1, y: 1 }, setups.puppet]];

  boost = false;
  boostMove = false;
}
