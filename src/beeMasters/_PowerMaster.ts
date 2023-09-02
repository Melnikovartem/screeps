// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { PowerBee } from "../bees/powerBee";
import type { PowerCell } from "../cells/stage2/powerCell";
import { profile } from "../profiler/decorator";
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
export abstract class PowerMaster extends Master<PowerCell> {
  public readonly powerCreep: PowerBee;
  protected usedPower = false;

  public constructor(cell: PowerCell, powerCreep: PowerBee) {
    super(cell, powerCreep.ref);
    this.powerCreep = powerCreep;
    if (!this.hive.resTarget[RESOURCE_OPS])
      this.hive.resTarget[RESOURCE_OPS] = HIVE_OPS;
  }

  public update() {
    super.update();
    this.usedPower = false;
    if (!this.powerCreep.shard)
      this.powerCreep.creep.spawn(this.parent.powerSpawn);
    if (this.powerCreep.creep.spawnCooldownTime) this.delete();
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

  public delete() {
    super.delete();
    delete Apiary.bees[this.powerCreep.ref];
  }
}
