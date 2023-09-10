import { setups } from "bees/creepSetups";

import type { Boosts } from "../_Master";
import type { FormationPositions } from "./squad";
import { SquadMaster } from "./squad";

// i am poor so there is this for top lvl harass
const TOWER_NUM = 6; // 6;
const TOWER_DMG = TOWER_NUM * TOWER_POWER_ATTACK * BOOSTS.tough.XGHO2.damage;
const TOUGHT_AMOUNT = Math.ceil(TOWER_DMG / 100);

const HEALER = setups.healer.copy();
HEALER.fixed = [RANGED_ATTACK, RANGED_ATTACK].concat(
  Array(TOUGHT_AMOUNT).fill(TOUGH)
);
HEALER.patternLimit =
  Math.ceil(TOWER_DMG / (HEAL_POWER * BOOSTS.heal.XLHO2.heal)) + 2;

// my most powerfull weapon to date
export class AnnoyOBot extends SquadMaster {
  public get boosts(): Boosts {
    return [
      { type: "rangedAttack", lvl: 2 },
      { type: "heal", lvl: 2 },
      { type: "damage", lvl: 2 },
      { type: "fatigue", lvl: 2 },
    ];
  }

  protected formation: FormationPositions = [[{ x: 0, y: 0 }, HEALER]];

  protected get checkup() {
    return this.checkMinerals(
      HEALER.getBody(this.hive.room.energyCapacityAvailable, 10).body
    );
  }
}
