import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";
import type { Boosts } from "../_Master";

// boosted duo to take down
export class FirstSquad extends SquadMaster {
  boosts: Boosts = [{ type: "rangedAttack", lvl: 2 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 2 }, { type: "fatigue", lvl: 0 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, setups.knight],
    [{ x: 1, y: 0 }, setups.knight],
  ]
}
