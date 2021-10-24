import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

import type { Boosts } from "../_Master";

const GANG = setups.knight.copy();

GANG.fixed = [TOUGH, TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];

// boosted duo to take down
export class GangDuo extends SquadMaster {
  boosts: Boosts = [{ type: "rangedAttack", lvl: 0 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 1 }, { type: "fatigue", lvl: 0 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, GANG],
    [{ x: 1, y: 0 }, GANG],
  ];

  get checkup() {
    return this.checkMinerals(GANG.getBody(this.hive.room.energyCapacityAvailable, 17).body);
  }
}
