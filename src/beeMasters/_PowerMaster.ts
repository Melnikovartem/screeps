// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { PowerBee } from "../bees/powerBee";
import type { PowerCell } from "../cells/stage2/powerCell";
import { profile } from "../profiler/decorator";
import type { MovePriority } from "./_Master";
import { Master } from "./_Master";

export const POWER_NAMES: { [id in PowerConstant]: string } = {
  [PWR_GENERATE_OPS]: "OPS",
  [PWR_OPERATE_SPAWN]: "SPAWN",
  [PWR_OPERATE_TOWER]: "TOWER",
  [PWR_OPERATE_STORAGE]: "STORAGE",
  [PWR_OPERATE_LAB]: "LAB",
  [PWR_OPERATE_EXTENSION]: "EXTENSION",
  [PWR_OPERATE_OBSERVER]: "OBSERVER",
  [PWR_OPERATE_TERMINAL]: "TERMINAL",
  [PWR_DISRUPT_SPAWN]: "SPAWN",
  [PWR_DISRUPT_TOWER]: "TOWER",
  [PWR_DISRUPT_SOURCE]: "SOURCE",
  [PWR_SHIELD]: "SHIELD",
  [PWR_REGEN_SOURCE]: "SOURCE",
  [PWR_REGEN_MINERAL]: "MINERAL",
  [PWR_DISRUPT_TERMINAL]: "TERMINAL",
  [PWR_OPERATE_POWER]: "POWER",
  [PWR_FORTIFY]: "FORTIFY",
  [PWR_OPERATE_CONTROLLER]: "CONTROLLER",
  [PWR_OPERATE_FACTORY]: "FACTORY",
};

export const HIVE_OPS = 5000;

@profile
export abstract class PowerCreepMaster extends Master<PowerCell> {
  // #region Properties (3)

  protected usedPower = false;

  public readonly powerCreep: PowerBee;

  // very important guys
  public override movePriority: MovePriority = 1;

  // #endregion Properties (3)

  // #region Constructors (1)

  public constructor(cell: PowerCell, powerCreep: PowerBee) {
    super(cell, powerCreep.ref);
    this.powerCreep = powerCreep;
    if (!this.hive.resTarget[RESOURCE_OPS])
      this.hive.resTarget[RESOURCE_OPS] = HIVE_OPS;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  // but they dont need bees
  public override get targetBeeCount(): number {
    return 0;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (3)

  public override delete() {
    super.delete();
    delete Apiary.bees[this.powerCreep.ref];
  }

  public run() {
    if (!this.usedPower) {
      const ans = this.powerCreep.usePower(PWR_GENERATE_OPS);
      if (ans === OK) {
        const pwrStats = this.powerCreep.powers[PWR_GENERATE_OPS];
        if (pwrStats)
          // failsafe
          Apiary.logger.addResourceStat(
            this.hiveName,
            this.powerCreep.ref.split(" ").join("_"),
            POWER_INFO[PWR_GENERATE_OPS].effect[pwrStats.level - 1],
            RESOURCE_OPS
          );
      }
    }
    this.checkFlee(this.powerCreep);
  }

  public override update() {
    super.update();
    this.usedPower = false;
    if (!this.powerCreep.shard)
      this.powerCreep.creep.spawn(this.parent.powerSpawn);
    if (this.powerCreep.creep.spawnCooldownTime) this.delete();
  }

  // #endregion Public Methods (3)

  // #region Protected Methods (1)

  protected chillMove() {
    // keep 150ops to 80% fill of storage
    const upperBound = Math.max(
      this.powerCreep.store.getCapacity(RESOURCE_OPS) * 0.9,
      150
    );
    const lowerBound = 150;
    const currOps = this.powerCreep.store.getUsedCapacity(RESOURCE_OPS);
    const targetBalance = Math.round(upperBound * 0.7 + lowerBound * 0.3);
    if (
      currOps < lowerBound &&
      this.hive.storage &&
      this.hive.storage.store.getUsedCapacity(RESOURCE_OPS)
    )
      this.powerCreep.withdraw(
        this.hive.storage,
        RESOURCE_OPS,
        targetBalance - currOps,
        this.hive.opt
      );
    if (
      currOps > upperBound &&
      this.hive.storage &&
      this.hive.storage.store.getFreeCapacity(RESOURCE_OPS)
    ) {
      this.powerCreep.transfer(
        this.hive.storage,
        RESOURCE_OPS,
        currOps - targetBalance,
        this.hive.opt
      );
    } else this.powerCreep.goRest(this.parent.pos, this.hive.opt);
  }

  // #endregion Protected Methods (1)
}
