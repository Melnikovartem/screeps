import { setups } from "../../bees/creepSetups";
import type { Boosts } from "../_Master";
import { FormationPositions, SquadMaster } from "./squad";

// const GANG = setups.archer.copy();

const TOUGHT_AMOUNT = 10;

/* const TOWER_NUM = 6; // 6;
const TOWER_DMG = TOWER_NUM * TOWER_POWER_ATTACK * BOOSTS.tough.XGHO2.damage;
const TOUGHT_AMOUNT = Math.ceil(TOWER_DMG / 100);

const HEAL_AMOUNT = Math.ceil(TOWER_DMG / (HEAL_POWER * BOOSTS.heal.XLHO2.heal) / 4 + 1);

GANG.fixed = Array(HEAL_AMOUNT).fill(HEAL).concat(Array(TOUGHT_AMOUNT).fill(TOUGH));*/

const ARCHER = setups.archer.copy();
ARCHER.fixed = [HEAL, HEAL].concat(Array(TOUGHT_AMOUNT).fill(TOUGH));

const HEALER = setups.healer.copy();
HEALER.fixed = [RANGED_ATTACK, RANGED_ATTACK].concat(
  Array(TOUGHT_AMOUNT).fill(TOUGH)
);

// my most powerfull weapon to date
export class GangQuad extends SquadMaster {
  // #region Properties (1)

  public formation: FormationPositions = [
    [{ x: 0, y: 0 }, ARCHER],
    [{ x: 1, y: 0 }, ARCHER],
    [{ x: 0, y: 1 }, HEALER],
    [{ x: 1, y: 1 }, HEALER],
  ];

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public get boosts(): Boosts {
    return [
      { type: "fatigue", lvl: 2 },
      { type: "rangedAttack", lvl: 2 },
      { type: "heal", lvl: 2 },
      { type: "damage", lvl: 2 },
    ];
  }

  public get checkup() {
    const healerMinerals = this.checkMinerals(
      HEALER.getBody(this.hive.room.energyCapacityAvailable, 10).body,
      2
    );
    const archerMinerals = this.checkMinerals(
      ARCHER.getBody(this.hive.room.energyCapacityAvailable, 10).body,
      2
    );
    return healerMinerals && archerMinerals;
  }

  // #endregion Public Accessors (2)
}

/* const ARCHER = setups.archer.copy();
ARCHER.fixed = [HEAL, HEAL].concat(Array(TOUGHT_AMOUNT).fill(TOUGH));

const HEALER = setups.healer.copy();
HEALER.fixed = [RANGED_ATTACK, RANGED_ATTACK].concat(Array(TOUGHT_AMOUNT).fill(TOUGH));

// my most powerfull weapon to date
export class QuadSquad extends SquadMaster {
  boosts: Boosts = [{ type: "fatigue", lvl: 2 }, { type: "rangedAttack", lvl: 2 }, { type: "heal", lvl: 2 }, { type: "damage", lvl: 2 }];
  formation: FormationPositions = [
    [{ x: 0, y: 0 }, ARCHER],
    [{ x: 1, y: 0 }, ARCHER],
    [{ x: 0, y: 1 }, HEALER],
    [{ x: 1, y: 1 }, HEALER],
  ];

  get checkup() {
    let healerMinerals = this.checkMinerals(HEALER.getBody(this.hive.room.energyCapacityAvailable, 10).body, 2);
    let archerMinerals = this.checkMinerals(ARCHER.getBody(this.hive.room.energyCapacityAvailable, 10).body, 2);
    return healerMinerals && archerMinerals;
  }
}*/
