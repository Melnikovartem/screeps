import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";
import type { Boosts } from "./squad";

const HEALER = setups.healer.copy();
HEALER.patternLimit = 15;

// can take 1 tower of dmg
export class FirstSquad extends SquadMaster {
  boosts: Boosts = [{ type: "rangedAttack" }, { type: "damage" }, { type: "heal" }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, setups.archer],
    [{ x: 1, y: 0 }, setups.archer],
    [{ x: 0, y: 1 }, HEALER],
    [{ x: 1, y: 1 }, HEALER],
  ]
}
