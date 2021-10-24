import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

import type { Boosts } from "../_Master";

const ARCHER = setups.knight.copy();
ARCHER.fixed = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, HEAL, HEAL];

const HEALER = setups.healer.copy();
HEALER.fixed = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK];

// my most powerfull weapon to date
export class QuadSquad extends SquadMaster {
  boosts: Boosts = [{ type: "rangedAttack", lvl: 2 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 2 }, { type: "fatigue", lvl: 2 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, ARCHER],
    [{ x: 1, y: 0 }, ARCHER],
    [{ x: 0, y: 1 }, HEALER],
    [{ x: 1, y: 1 }, HEALER],
  ];

  get checkup() {
    let healerMinerals = this.checkMinerals(HEALER.getBody(this.hive.room.energyCapacityAvailable, 10).body);
    let archerMinerals = this.checkMinerals(ARCHER.getBody(this.hive.room.energyCapacityAvailable, 10).body);
    return healerMinerals && archerMinerals;
  }
}
