import { setups } from "../../bees/creepSetups";
import { SquadMaster, FormationPositions } from "./squad";

import type { Boosts } from "../_Master";

const TOWER_NUM = 3; // 6;
const TOWER_DMG = TOWER_NUM * TOWER_POWER_ATTACK * BOOSTS.tough.XGHO2.damage;
const TOUGHT_AMOUNT = Math.ceil(TOWER_DMG / 100);

const DISMANTLER = setups.dismantler.copy();
DISMANTLER.fixed = [RANGED_ATTACK].concat(Array(TOUGHT_AMOUNT).fill(TOUGH));
DISMANTLER.patternLimit = 20;

const HEALER = setups.healer.copy();
HEALER.fixed = [RANGED_ATTACK].concat(Array(TOUGHT_AMOUNT).fill(TOUGH));
HEALER.patternLimit =
  Math.ceil(TOWER_DMG / (HEAL_POWER * BOOSTS.heal.XLHO2.heal)) + 1;

// my most powerfull weapon to date
export class DismanleBoys extends SquadMaster {
  boosts: Boosts = [
    { type: "rangedAttack", lvl: 1 },
    { type: "dismantle", lvl: 2 },
    { type: "heal", lvl: 2 },
    { type: "damage", lvl: 2 },
    { type: "fatigue", lvl: 1 },
  ];

  get formation(): FormationPositions {
    if (
      this.pos.x <= 2 ||
      this.pos.x >= 48 ||
      this.pos.y <= 2 ||
      this.pos.y >= 48
    )
      return [
        [{ x: 0, y: 0 }, HEALER],
        [{ x: 1, y: 0 }, DISMANTLER],
        [{ x: -1, y: 0 }, DISMANTLER],
      ];
    return [
      [{ x: 0, y: 0 }, DISMANTLER],
      [{ x: 1, y: 0 }, DISMANTLER],
      [{ x: 0, y: 1 }, HEALER],
    ];
  }

  get checkup() {
    const healerMinerals = this.checkMinerals(
      HEALER.getBody(this.hive.room.energyCapacityAvailable, 10).body,
      1
    );
    const archerMinerals = this.checkMinerals(
      DISMANTLER.getBody(this.hive.room.energyCapacityAvailable, 10).body,
      2
    );
    return healerMinerals && archerMinerals;
  }
}
