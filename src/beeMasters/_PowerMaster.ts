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
export abstract class PowerMaster extends Master {
  readonly powerCreep: PowerBee;
  readonly cell: PowerCell;
  usedPower = false;

  constructor(cell: PowerCell, powerCreep: PowerBee) {
    super(cell.hive, powerCreep.ref);
    this.cell = cell;
    this.powerCreep = powerCreep;
    if (!this.hive.resTarget[RESOURCE_OPS])
      this.hive.resTarget[RESOURCE_OPS] = HIVE_OPS;
  }

  update() {
    super.update();
    if (!this.powerCreep.shard)
      this.powerCreep.creep.spawn(this.cell.powerSpawn);
    if (this.powerCreep.creep.spawnCooldownTime) this.delete();
  }

  run() {
    if (!this.usedPower) {
      const ans = this.powerCreep.usePower(PWR_GENERATE_OPS);
      if (ans === OK && Apiary.logger) {
        const pwrStats = this.powerCreep.powers[PWR_GENERATE_OPS];
        if (pwrStats)
          Apiary.logger.addResourceStat(
            this.hive.roomName,
            "PowerCreep",
            POWER_INFO[PWR_GENERATE_OPS].effect[pwrStats.level],
            RESOURCE_OPS
          );
      }
    }
    this.usedPower = false;
    this.checkFlee(this.powerCreep);
  }

  delete() {
    super.delete();
    delete Apiary.bees[this.powerCreep.ref];
  }
}
