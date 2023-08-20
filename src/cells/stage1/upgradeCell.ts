import { Cell } from "../_Cell";
import { UpgraderMaster } from "../../beeMasters/economy/upgrader";

import { prefix, hiveStates } from "../../enums";
import { setups } from "../../bees/creepSetups";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "./storageCell";

@profile
export class UpgradeCell extends Cell {
  controller: StructureController;
  link: StructureLink | undefined;
  master: UpgraderMaster;
  sCell: StorageCell;
  maxRate = 1;
  ratePerCreepMax = 1;
  workPerCreepMax = 1;
  maxBees = 10;

  roadTime: number;

  constructor(hive: Hive, controller: StructureController, sCell: StorageCell) {
    super(hive, prefix.upgradeCell + "_" + hive.room.name);
    this.sCell = sCell;

    this.controller = controller;

    this.link = _.filter(
      this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3),
      (structure) => structure.structureType === STRUCTURE_LINK
    )[0] as StructureLink;

    this.roadTime = this.hive.pos.getTimeForPath(this);
    if (this.roadTime === Infinity) this.roadTime = 0;

    this.master = new UpgraderMaster(this);
  }

  get pos() {
    return this.controller.pos;
  }

  recalculateRate() {
    const futureResourceCells = _.filter(
      Game.flags,
      (f) =>
        f.color === COLOR_YELLOW &&
        f.secondaryColor === COLOR_YELLOW &&
        f.memory.hive === this.hive.roomName
    );
    this.maxRate = Math.max(1, futureResourceCells.length) * 10;

    let setup;
    let suckerTime = 0;

    if (this.link && this.sCell.link) {
      this.maxRate = Math.min(
        800 / this.link.pos.getRangeTo(this.sCell.link),
        this.maxRate
      ); // how to get more in?
      _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        if (cell.link)
          this.maxRate += Math.min(
            800 / this.link!.pos.getRangeTo(cell.link),
            cell.ratePT
          );
      });
      setup = setups.upgrader.fast;
    } else {
      suckerTime = Math.max(
        this.sCell.storage.pos.getTimeForPath(this.controller) * 2 - 3,
        0
      );
      if (this.controller.pos.getRangeTo(this.sCell.storage) < 4)
        setup = setups.upgrader.fast;
      else setup = setups.upgrader.manual;
    }

    setup.patternLimit = Infinity;
    const body = setup.getBody(this.hive.room.energyCapacityAvailable).body;
    const carry = body.filter((b) => b === CARRY).length * CARRY_CAPACITY;
    const work = body.filter((b) => b === WORK).length;
    this.ratePerCreepMax = carry / (suckerTime + carry / work);
    this.workPerCreepMax = work;

    this.maxBees = 10;
    if (this.link)
      this.maxBees = this.link.pos
        .getOpenPositions(true)
        .filter((p) => p.getRangeTo(this.controller) <= 3).length;
  }

  get maxPossibleRate() {
    return this.controller.level === 8 ? 15 : Infinity;
  }

  update() {
    super.update();
    /* if (!this.link && Game.time % 30 === 7 && this.controller.level >= 5 && Object.keys(this.sCell.links).length) {
      this.link = <StructureLink>_.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), structure => structure.structureType === STRUCTURE_LINK)[0];
      if (this.link)
        this.recalculateRate();
    } */

    if (
      this.hive.phase === 1 &&
      this.controller.level === 8 &&
      Apiary.useBucket
    )
      Apiary.destroyTime = Game.time;

    if (Game.time === Apiary.createTime) this.recalculateRate();

    if (!this.master.beesAmount) return;

    const freeCap =
      this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && freeCap >= LINK_CAPACITY / 2) {
      if (this.sCell.link) {
        if (
          !this.sCell.master.activeBees.length ||
          this.hive.state === hiveStates.lowenergy
        )
          return;
        this.sCell.requestFromStorage(
          [this.sCell.link],
          freeCap >= LINK_CAPACITY - 100 ? 3 : 1,
          RESOURCE_ENERGY
        );
        if (!this.sCell.linkState || this.sCell.linkState.priority >= 1)
          this.sCell.linkState = {
            using: this.ref,
            priority: 1,
            lastUpdated: Game.time,
          };
      }
    }
  }

  run() {
    if (!this.master.beesAmount) return;
    if (
      this.link &&
      this.sCell.link &&
      this.sCell.linkState &&
      this.sCell.linkState.using === this.ref
    ) {
      const freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (freeCap < LINK_CAPACITY / 2) return;
      if (
        freeCap <= this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY) ||
        freeCap >= LINK_CAPACITY * 0.85
      ) {
        const amount = Math.min(
          freeCap,
          this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY)
        );
        if (
          !this.sCell.link.cooldown &&
          this.sCell.link.transferEnergy(this.link, amount) === OK
        )
          if (Apiary.logger)
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "upgrade",
              -amount * 0.03,
              RESOURCE_ENERGY
            );
      }
    }
  }
}
