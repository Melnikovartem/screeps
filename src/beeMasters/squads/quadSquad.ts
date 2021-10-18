import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

const HEALER = setups.healer.copy();
HEALER.patternLimit = 18;

// can eat 2 towers of dmg (15*2*12*4 = 1440 > 1200)
export class FirstSquad extends SquadMaster {
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, setups.archer],
    [{ x: 1, y: 0 }, setups.archer],
    [{ x: 0, y: 1 }, HEALER],
    [{ x: 1, y: 1 }, HEALER],
  ]
}
