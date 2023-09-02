import type { PowerBee } from "bees/powerBee";
import type { DefenseCell } from "cells/base/defenseCell";
import type { ResourceCell } from "cells/base/resourceCell";
import type { RespawnCell } from "cells/base/respawnCell";
import type { FactoryCell } from "cells/stage1/factoryCell";
import type { LaboratoryCell } from "cells/stage1/laboratoryCell";
import type { StorageCell } from "cells/stage1/storageCell";
import type { UpgradeCell } from "cells/stage1/upgradeCell";
import type { ObserveCell } from "cells/stage2/observeCell";
import type { PowerCell } from "cells/stage2/powerCell";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";

import { POWER_NAMES, PowerCreepMaster } from "../_PowerMaster";
import { defenseWalls } from "./nkvd-utils";

@profile
export class NKVDMaster extends PowerCreepMaster {
  // #region Properties (2)

  private nextup?: {
    target: RoomObject;
    power: keyof NKVDMaster["targets"];
    time: number;
  };
  private targets: {
    [PWR_OPERATE_SPAWN]?: RespawnCell;

    [PWR_OPERATE_FACTORY]?: FactoryCell;
    [PWR_OPERATE_LAB]?: LaboratoryCell;
    [PWR_OPERATE_OBSERVER]?: ObserveCell;

    [PWR_OPERATE_EXTENSION]?: StorageCell;
    [PWR_OPERATE_TERMINAL]?: StorageCell;
    [PWR_OPERATE_STORAGE]?: StorageCell;

    [PWR_FORTIFY]?: DefenseCell;
    [PWR_OPERATE_TOWER]?: DefenseCell;

    [PWR_OPERATE_CONTROLLER]?: UpgradeCell;
    [PWR_OPERATE_POWER]?: PowerCell;

    [PWR_REGEN_SOURCE]?: ResourceCell[];
    [PWR_REGEN_MINERAL]?: ResourceCell[];
  } = {};

  // #endregion Properties (2)

  // #region Constructors (1)

  public constructor(cell: PowerCell, powerCreep: PowerBee) {
    super(cell, powerCreep);
    this.updateTargets();
    this.parent.powerManager = this.powerCreep.ref;
  }

  // #endregion Constructors (1)

  // #region Public Methods (2)

  public override run() {
    if (this.hive.cells.defense.timeToLand < 50)
      this.powerCreep.fleeRoom(this.hiveName, this.hive.opt);
    else if (this.powerCreep.ticksToLive <= POWER_CREEP_LIFE_TIME / 5)
      this.powerCreep.renew(this.parent.powerSpawn, this.hive.opt);
    else if (!this.hive.controller.isPowerEnabled)
      this.powerCreep.enableRoom(this.hive.controller, this.hive.opt);
    else if (this.nextup && Game.time >= this.nextup.time) {
      const ans = this.powerCreep.usePower(
        this.nextup.power,
        this.nextup.target,
        this.hive.opt
      );
      if (ans === OK) {
        this.usedPower = true;

        const pwrInfo = POWER_INFO[this.nextup.power];
        if ("ops" in pwrInfo)
          Apiary.logger.addResourceStat(
            this.hiveName,
            "NKVD_" + POWER_NAMES[this.nextup.power],
            -pwrInfo.ops,
            RESOURCE_OPS
          );

        this.nextup = undefined;
      } else if (
        ans === ERR_NOT_ENOUGH_RESOURCES &&
        this.parent.sCell.storage.store.getUsedCapacity(RESOURCE_OPS) > 0
      )
        this.powerCreep.withdraw(this.parent.sCell.storage, RESOURCE_OPS);
      else if (ans !== ERR_NOT_IN_RANGE) this.chillMove();
    } else this.chillMove();
    super.run();
  }

  public override update() {
    super.update();
    if (!this.nextup || Game.time % 50 === 0) this.getNext();
  }

  // #endregion Public Methods (2)

  // #region Private Methods (4)

  private chillMove() {
    // keep 150ops to 90% fill of storage
    const upperBound = Math.max(
      this.powerCreep.store.getCapacity(RESOURCE_OPS) * 0.9,
      150
    );
    const lowerBound = 150;
    const currOps = this.powerCreep.store.getUsedCapacity(RESOURCE_OPS);
    const targetBalance = Math.round(upperBound * 0.7 + lowerBound * 0.3);
    if (currOps < lowerBound) {
      this.powerCreep.withdraw(
        this.parent.sCell.storage,
        RESOURCE_OPS,
        targetBalance - currOps,
        this.hive.opt
      );
      return;
    }
    if (currOps > upperBound) {
      this.powerCreep.transfer(
        this.parent.sCell.storage,
        RESOURCE_OPS,
        currOps - targetBalance,
        this.hive.opt
      );
      return;
    }
    this.powerCreep.goRest(this.parent.pos, this.hive.opt);
  }

  private getNext() {
    this.nextup = undefined;
    if (
      (this.hive.resState[RESOURCE_OPS] || 0) < 0 &&
      this.hive.state !== hiveStates.battle
    )
      return;
    const nextups: Exclude<NKVDMaster["nextup"], undefined>[] = [];
    for (const powerId in this.powerCreep.powers) {
      const power = +powerId as keyof NKVDMaster["targets"];
      const targets = this.targets[power];
      if (!targets) continue;
      const powerStats = this.powerCreep.powers[power];
      const cooldownEnd = Game.time + (powerStats.cooldown || 0);
      const andNextup = (s: RoomObject, padding: number = 10) =>
        nextups.push({
          target: s,
          power,
          time: Math.max(this.getTimeToRegen(s, power) - padding, cooldownEnd),
        });
      switch (power) {
        case PWR_OPERATE_SPAWN: {
          const spawn = targets as RespawnCell;
          if (
            (!spawn.freeSpawns.length &&
              _.filter(spawn.spawnQue, (b) => b.priority === 1).length > 0) || // spawnBattle screeps
            (Object.keys(spawn.spawnQue).length >= 3 &&
              !_.filter(spawn.spawns, (s) => !s.spawning).length)
          )
            // push some traffic
            _.forEach(
              _.map(spawn.spawns, (s) => s).sort(
                (a, b) =>
                  (a.spawning ? a.spawning.remainingTime : 0) -
                  (b.spawning ? b.spawning.remainingTime : 0)
              ),
              (s) => andNextup(s)
            );
          break;
        }
        case PWR_OPERATE_FACTORY: {
          const factory = (targets as FactoryCell).factory;
          if (
            factory &&
            ((factory.level === powerStats.level &&
              (targets as FactoryCell).uncommon) ||
              !factory.level)
          )
            andNextup(factory, 20);
          break;
        }
        case PWR_OPERATE_LAB: {
          const lab = targets as LaboratoryCell;
          // boost labs if already loaded (not before cause loosing ops)
          // or maybe before cause its just 8/1000 of ops each tick and managers can pull off in about 50 ticks
          // so is 1/125 ops == possible loss of minerals (8)
          // (lab.prodSetup)
          if (lab.prod)
            _.forEach(lab.laboratories, (l) => {
              if (lab.labStates[l.id] === "production") andNextup(l);
            });
          break;
        }
        case PWR_OPERATE_OBSERVER:
          andNextup((targets as ObserveCell).obeserver);
          break;
        case PWR_OPERATE_EXTENSION:
        case PWR_OPERATE_STORAGE:
          if ((targets as StorageCell).storage)
            andNextup((targets as StorageCell).storage);
          break;
        case PWR_OPERATE_TERMINAL:
          if ((targets as StorageCell).terminal)
            andNextup((targets as StorageCell).terminal!);
          break;
        case PWR_FORTIFY:
          if (this.hive.isBattle)
            _.forEach(defenseWalls(this.hiveName), (s) => andNextup(s, 0));
          break;
        case PWR_OPERATE_TOWER:
          if (this.hive.isBattle)
            _.forEach((targets as DefenseCell).towers, (s) => andNextup(s, 5));
          break;
        case PWR_OPERATE_CONTROLLER:
          andNextup((targets as UpgradeCell).controller);
          break;
        case PWR_OPERATE_POWER:
          andNextup((targets as PowerCell).powerSpawn);
          break;
        case PWR_REGEN_SOURCE:
          _.forEach(
            _.map(targets as ResourceCell[], (r) => r.resource),
            (s) => andNextup(s)
          );
          break;
        case PWR_REGEN_MINERAL:
          _.forEach(
            _.map(targets as ResourceCell[], (r) => r.resource),
            (s) => andNextup(s)
          );
          break;
      }
    }
    if (!nextups.length) return;
    this.nextup = nextups.reduce((prev, curr) =>
      curr.time < prev.time ? curr : prev
    );
  }

  private getTimeToRegen(obj: RoomObject, pwr: PowerConstant) {
    if (!obj.effects) return Game.time;
    const powerEffect = obj.effects.filter((e) => e.effect === pwr)[0] as
      | PowerEffect
      | undefined;
    if (powerEffect) return Game.time + powerEffect.ticksRemaining;
    return Game.time;
  }

  private updateTargets() {
    for (const powerId in this.powerCreep.powers) {
      const power = +powerId as PowerConstant;
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

        case PWR_FORTIFY: // fortify doesn't need cell
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
          this.targets[power] = _.filter(
            this.hive.cells.excavation.resourceCells,
            (r) =>
              r.pos.roomName === this.hiveName && r.resource instanceof Source
          );
          break;
        case PWR_REGEN_MINERAL:
          this.targets[power] = _.filter(
            this.hive.cells.excavation.resourceCells,
            (r) =>
              r.pos.roomName === this.hiveName && r.resource instanceof Mineral
          );
          break;
      }
    }
  }

  // #endregion Private Methods (4)
}
