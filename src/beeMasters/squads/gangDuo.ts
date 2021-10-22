import { setups } from "../../bees/creepsetups";
import { BOOST_MINERAL, BOOST_PARTS } from "../../cells/stage1/laboratoryCell"
import { SquadMaster, FormationPositions } from "./squad";

import type { Boosts } from "../_Master";

const GANG = setups.knight.copy();

GANG.fixed = [TOUGH, TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];

// boosted duo to take down
export class GangDuo extends SquadMaster {
  boosts: Boosts = [{ type: "rangedAttack", lvl: 2 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 1 }, { type: "fatigue", lvl: 0 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, GANG],
    [{ x: 1, y: 0 }, GANG],
  ]

  get checkup() {
    if (!this.hive.cells.storage)
      return false;
    let usedCap = this.hive.cells.storage.getUsedCapacity;
    let body = GANG.getBody(this.hive.room.energyCapacityAvailable, 17).body;
    let ans = true;
    _.forEach(this.boosts, b => {
      let res = BOOST_MINERAL[b.type][b.lvl];
      let amountNeeded = LAB_BOOST_MINERAL * _.sum(body, bb => bb === BOOST_PARTS[b.type] ? 1 : 0) * this.formation.length;
      if (amountNeeded && usedCap(res) < amountNeeded) {
        this.hive.add(this.hive.mastersResTarget, res, amountNeeded);
        ans = false;
      }
    });
    return ans;
  }

  get emergency() {
    return false;
  }
}
