import { setups } from "../../bees/creepsetups";
import { SquadMaster, FormationPositions } from "./squad";

import type { Boosts } from "../_Master";

const GANG = setups.knight.copy();

const TOWER_NUM = 3; // 6;
const TOWER_DMG = TOWER_NUM * TOWER_POWER_ATTACK * BOOSTS.tough.XGHO2.damage;
const HEAL_AMOUNT = Math.ceil(TOWER_DMG / (HEAL_POWER * BOOSTS.heal.XLHO2.heal) / 2);
const TOUGHT_AMOUNT = Math.ceil((TOWER_DMG * 2 - HEAL_AMOUNT * HEAL_POWER * BOOSTS.heal.XLHO2.heal) / 100);

GANG.fixed = Array(HEAL_AMOUNT).fill(HEAL).concat(Array(TOUGHT_AMOUNT).fill(TOUGH));

// boosted duo to take down
export class GangDuo extends SquadMaster {
  boosts: Boosts = [{ type: "fatigue", lvl: 2 }, { type: "rangedAttack", lvl: 2 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 2 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, GANG],
    [{ x: 1, y: 0 }, GANG],
  ];

  get checkup() {
    return this.checkMinerals(GANG.getBody(this.hive.room.energyCapacityAvailable, 17).body);
  }

  get extreme() {
    return true;
  }
}
