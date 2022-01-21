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
  nextup?: { target: RoomObject, power: keyof NKVDMaster["targets"], time: number };
  targets: {
    [PWR_OPERATE_SPAWN]?: RespawnCell,

    [PWR_OPERATE_FACTORY]?: FactoryCell,
    [PWR_OPERATE_LAB]?: LaboratoryCell,
    [PWR_OPERATE_OBSERVER]?: ObserveCell,

    [PWR_OPERATE_EXTENSION]?: StorageCell,
    [PWR_OPERATE_TERMINAL]?: StorageCell,
    [PWR_OPERATE_STORAGE]?: StorageCell,


    [PWR_FORTIFY]?: DefenseCell,
    [PWR_OPERATE_TOWER]?: DefenseCell,

    [PWR_OPERATE_CONTROLLER]?: UpgradeCell,
    [PWR_OPERATE_POWER]?: PowerCell,

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
          this.targets[power] = this.hive.cells.factory;
          break;
        case PWR_OPERATE_LAB:
          this.targets[power] = this.hive.cells.lab;
          break;
        case PWR_OPERATE_OBSERVER:
          this.targets[power] = this.hive.cells.observe;
          break;

        case PWR_OPERATE_EXTENSION:
        case PWR_OPERATE_STORAGE:
        case PWR_OPERATE_TERMINAL:
          this.targets[power] = this.hive.cells.storage;
          break;

        case PWR_FORTIFY:
        case PWR_OPERATE_TOWER:
          this.targets[power] = this.hive.cells.defense;
          break;

        case PWR_OPERATE_CONTROLLER:
          this.targets[power] = this.hive.cells.upgrade;
          break;
        case PWR_OPERATE_POWER:
          this.targets[power] = this.hive.cells.power;
          break;

        case PWR_REGEN_SOURCE:
          this.targets[power] = _.filter(this.hive.cells.excavation.resourceCells,
            r => r.pos.roomName === this.hive.roomName && r.resource instanceof Source);
          break;
        case PWR_REGEN_MINERAL:
          this.targets[power] = _.filter(this.hive.cells.excavation.resourceCells,
            r => r.pos.roomName === this.hive.roomName && r.resource instanceof Mineral);
          break;
      }
    }
  }

  getTimeToRegen(obj: RoomObject, pwr: PowerConstant) {
    if (!obj.effects)
      return Game.time;
    let powerEffect = <PowerEffect | undefined>obj.effects.filter(e => e.effect === pwr)[0];
    if (powerEffect)
      return Game.time + powerEffect.ticksRemaining;
    return Game.time;
  }

  getNext() {
    this.nextup = undefined;
    if ((this.hive.resState[RESOURCE_OPS] || 0) < 0 && this.hive.state !== hiveStates.battle)
      return;
    let nextups: Exclude<NKVDMaster["nextup"], undefined>[] = [];
    for (const powerId in this.powerCreep.powers) {
      let power = <keyof NKVDMaster["targets"]>+powerId;
      let targets = this.targets[power];
      if (!targets)
        continue;
      let powerStats = this.powerCreep.powers[power];
      let cooldownEnd = Game.time + (powerStats.cooldown || 0);
      let andNextup = (s: RoomObject, padding: number = 10) =>
        nextups.push({ target: s, power: power, time: Math.max(this.getTimeToRegen(s, power) - padding, cooldownEnd) })
      switch (power) {
        case PWR_OPERATE_SPAWN:
          let spawn = (<RespawnCell>targets);
          if (!spawn.freeSpawns.length
            && (_.filter(this.hive.spawOrders, b => b.priority === 1).length > 0) // spawnBattle screeps
            || Object.keys(this.hive.spawOrders).length >= 3
            && !_.filter(spawn.spawns, s => !s.spawning || s.spawning.remainingTime <= 13 * 3).length) // push some traffic
            _.forEach(_.map(spawn.spawns, s => s).sort((a, b) =>
              (a.spawning ? a.spawning.remainingTime : 0) - (b.spawning ? b.spawning.remainingTime : 0)), (s) => andNextup(s));
          break;
        case PWR_OPERATE_FACTORY:
          let factory = (<FactoryCell>targets).factory;
          if (factory.level === powerStats.level && (<FactoryCell>targets).uncommon || !factory.level)
            andNextup(factory, 20);
          break;
        case PWR_OPERATE_LAB:
          let lab = (<LaboratoryCell>targets);
          if (lab.prod)
            _.forEach(lab.laboratories, l => {
              if (lab.labStates[l.id] === "production")
                andNextup(l);
            });
          break;
        case PWR_OPERATE_OBSERVER:
          andNextup((<ObserveCell>targets).obeserver);
          break;
        case PWR_OPERATE_EXTENSION:
          _.forEach((<StorageCell>targets).storage, (s) => andNextup(s));
          break;
        case PWR_OPERATE_STORAGE:
          if ((<StorageCell>targets).storage instanceof StructureStorage)
            _.forEach((<StorageCell>targets).storage, (s) => andNextup(s));
          break;
        case PWR_OPERATE_TERMINAL:
          if ((<StorageCell>targets).terminal)
            _.forEach((<StorageCell>targets).terminal!, (s) => andNextup(s));
          break;
        case PWR_FORTIFY:
          if (this.hive.state >= hiveStates.battle)
            _.forEach((<DefenseCell>targets).walls, (s) => andNextup(s, 0));
          break;
        case PWR_OPERATE_TOWER:
          if (this.hive.state >= hiveStates.battle)
            _.forEach((<DefenseCell>targets).towers, (s) => andNextup(s, 5));
          break;
        case PWR_OPERATE_CONTROLLER:
          _.forEach((<UpgradeCell>targets).controller, (s) => andNextup(s));
          break;
        case PWR_OPERATE_POWER:
          _.forEach((<PowerCell>targets).powerSpawn, (s) => andNextup(s));
          break;
        case PWR_REGEN_SOURCE:
          _.forEach(_.map((<ResourceCell[]>targets), r => r.resource), (s) => andNextup(s));
          break;
        case PWR_REGEN_MINERAL:
          _.forEach(_.map((<ResourceCell[]>targets), r => r.resource), (s) => andNextup(s));
          break;
      }
    }
    if (!nextups.length)
      return;
    this.nextup = nextups.reduce((prev, curr) => curr.time < prev.time ? curr : prev);
  }

  update() {
    super.update();
    if (!this.nextup || Game.time % 50 === 0)
      this.getNext();
  }

  chillMove() {
    if (this.powerCreep.ticksToLive < POWER_CREEP_LIFE_TIME / 2)
      this.powerCreep.renew(this.cell.powerSpawn, this.hive.opt);
    else if (this.powerCreep.store.getUsedCapacity(RESOURCE_OPS) > Math.max(200, this.powerCreep.store.getCapacity(RESOURCE_OPS) * 0.9)) {
      this.powerCreep.transfer(this.cell.sCell.storage, RESOURCE_OPS, this.powerCreep.store.getUsedCapacity(RESOURCE_OPS) - 200, this.hive.opt)
    } else
      this.powerCreep.goRest(this.cell.pos, this.hive.opt);
  }

  run() {
    if (this.hive.cells.defense.timeToLand < 50)
      this.powerCreep.fleeRoom(this.hive.roomName, this.hive.opt);
    else if (this.powerCreep.ticksToLive <= POWER_CREEP_LIFE_TIME / 5)
      this.powerCreep.renew(this.cell.powerSpawn, this.hive.opt);
    else if (!this.hive.controller.isPowerEnabled)
      this.powerCreep.enableRoom(this.hive.controller, this.hive.opt);
    else if (this.nextup && Game.time >= this.nextup.time) {
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
