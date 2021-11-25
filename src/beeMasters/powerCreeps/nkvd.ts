import { PowerMaster } from "../_PowerMaster";

import { hiveStates } from "../../enums";
import { profile } from "../../profiler/decorator";

import { POWER_NAMES } from "../_PowerMaster";

import type { PowerBee } from "../../bees/powerBee";
import type { PowerCell } from "../../cells/stage2/powerCell";

import type { RespawnCell } from "../../cells/base/respawnCell";
import type { DefenseCell } from "../../cells/base/defenseCell";
import type { ResourceCell } from "../../cells/base/resourceCell";
import type { FactoryCell } from "../../cells/stage1/factoryCell";
import type { LaboratoryCell } from "../../cells/stage1/laboratoryCell";
import type { StorageCell } from "../../cells/stage1/storageCell";
import type { UpgradeCell } from "../../cells/stage1/upgradeCell";
import type { ObserveCell } from "../../cells/stage2/observeCell";

@profile
export class NKVDMaster extends PowerMaster {
  nextup?: { target: Structure, power: keyof NKVDMaster["targets"], time: number };
  targets: {
    [PWR_OPERATE_SPAWN]?: RespawnCell,
    [PWR_OPERATE_EXTENSION]?: RespawnCell,

    [PWR_OPERATE_FACTORY]?: FactoryCell,

    [PWR_OPERATE_TERMINAL]?: StorageCell,
    [PWR_OPERATE_STORAGE]?: StorageCell,

    [PWR_OPERATE_LAB]?: LaboratoryCell,
    [PWR_OPERATE_TOWER]?: DefenseCell,
    [PWR_OPERATE_OBSERVER]?: ObserveCell,

    [PWR_OPERATE_CONTROLLER]?: UpgradeCell,

    [PWR_REGEN_SOURCE]?: ResourceCell[],
    [PWR_REGEN_MINERAL]?: ResourceCell[],
  } = {};

  constructor(cell: PowerCell, powerCreep: PowerBee) {
    super(cell, powerCreep);
    this.updateTargets();
    this.cell.powerManager = this.powerCreep.ref;
  }

  updateTargets() {
    for (const powerId in this.powerCreep.powers) {
      let power = <PowerConstant>+powerId;
      switch (power) {
        case PWR_OPERATE_SPAWN:
          this.targets[power] = this.hive.cells.spawn;
          break;
        case PWR_OPERATE_FACTORY:
          if (this.hive.roomName !== "E37S23")
            this.targets[power] = this.hive.cells.factory;
          break;
      }
    }
  }

  getTimeToRegen(structure: Structure, pwr: PowerConstant) {
    if (!structure.effects)
      return Game.time;
    let powerEffect = <PowerEffect | undefined>structure.effects.filter(e => e.effect === pwr)[0];
    if (powerEffect)
      return Game.time + powerEffect.ticksRemaining;
    return Game.time;
  }

  getNext() {
    let nextups: Exclude<NKVDMaster["nextup"], undefined>[] = [];
    for (const powerId in this.powerCreep.powers) {
      let power = <keyof NKVDMaster["targets"]>+powerId;
      let targets = this.targets[power];
      if (!targets)
        continue;
      let powerStats = this.powerCreep.powers[power];
      let cooldownEnd = Game.time + (powerStats.cooldown || 0);
      let andNextup = (s: Structure) => nextups.push({ target: s, power: power, time: Math.max(this.getTimeToRegen(s, power), cooldownEnd) })
      switch (power) {
        case PWR_OPERATE_SPAWN:
          if (!this.hive.cells.spawn.freeSpawns.length
            && (Object.keys(this.hive.spawOrders).length > 3
              || _.filter(this.hive.spawOrders, b => b.priority <= 1).length > 0))
            _.forEach((<RespawnCell>targets).spawns, andNextup);
          break;
        case PWR_OPERATE_FACTORY:
          andNextup((<FactoryCell>targets).factory);
          break;
      }
    }
    if (!nextups.length)
      return;
    this.nextup = nextups.reduce((prev, curr) => curr.time < prev.time ? curr : prev);
  }

  update() {
    super.update();
    if (!this.nextup)
      this.getNext();
  }

  chillMove() {
    if (this.powerCreep.ticksToLive < POWER_CREEP_LIFE_TIME / 2)
      this.powerCreep.renew(this.cell.powerSpawn, this.hive.opt);
    else if (this.powerCreep.store.getUsedCapacity(RESOURCE_OPS) > Math.max(200, this.powerCreep.store.getCapacity(RESOURCE_OPS) * 0.9)) {
      this.powerCreep.transfer(this.cell.sCell.storage, RESOURCE_OPS, this.powerCreep.store.getUsedCapacity(RESOURCE_OPS) - 200, this.hive.opt)
    } else
      this.powerCreep.goRest(this.hive.state === hiveStates.battle ? this.hive.pos : this.hive.rest, this.hive.opt);
  }

  run() {
    if (this.powerCreep.ticksToLive <= POWER_CREEP_LIFE_TIME / 5)
      this.powerCreep.renew(this.cell.powerSpawn, this.hive.opt);
    else if (!this.hive.controller.isPowerEnabled)
      this.powerCreep.enableRoom(this.hive.controller, this.hive.opt);
    else if (this.nextup && Game.time >= this.nextup.time - 10) {
      let ans = this.powerCreep.usePower(this.nextup.power, this.nextup.target, this.hive.opt);
      if (ans === OK) {
        this.usedPower = true;
        if (Apiary.logger) {
          let pwrInfo = POWER_INFO[this.nextup.power];
          if ("ops" in pwrInfo)
            Apiary.logger.addResourceStat(this.hive.roomName, "NKVD_" + POWER_NAMES[this.nextup.power], -pwrInfo.ops, RESOURCE_OPS);
        }
        this.nextup = undefined;
      } else if (ans === ERR_NOT_ENOUGH_RESOURCES && this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_OPS) > 0)
        this.powerCreep.withdraw(this.cell.sCell.storage, RESOURCE_OPS)
      else if (ans !== ERR_NOT_IN_RANGE)
        this.chillMove();
    } else
      this.chillMove();
    super.run();
  }
}
