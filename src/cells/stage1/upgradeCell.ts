import { Cell } from "../_Cell";
import { UpgraderMaster } from "../../beeMasters/economy/upgrader";

import { prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class UpgradeCell extends Cell {

  controller: StructureController;
  link: StructureLink | undefined;
  storageLink: StructureLink | undefined;
  master: UpgraderMaster;

  maxRate = 1;
  ratePerCreepMax = 1;

  constructor(hive: Hive, controller: StructureController) {
    super(hive, prefix.upgradeCell + hive.room.name);

    this.controller = controller;

    this.link = <StructureLink>_.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), structure => structure.structureType === STRUCTURE_LINK)[0];

    if (this.link)
      this.pos = this.link.pos;
    else
      this.pos = this.controller.pos;

    this.master = new UpgraderMaster(this);
    this.recalculateRate();
  }

  recalculateRate() {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      let futureResourceCells = _.filter(Game.flags, f => f.color === COLOR_YELLOW && f.secondaryColor === COLOR_YELLOW && f.memory.hive === this.hive.roomName);
      this.maxRate = Math.max(1, futureResourceCells.length) * 10;

      let storageLink = storageCell.links[Object.keys(storageCell.links)[0]];
      let body;
      let suckerTime = 0;

      if (this.link && storageLink) {
        this.maxRate = Math.min(800 / this.link.pos.getRangeTo(storageLink), this.maxRate); // how to get more in?
        body = setups.upgrader.fast.getBody(this.hive.room.energyCapacityAvailable).body;
      } else {
        suckerTime = Math.max(storageCell.storage.pos.getTimeForPath(this.controller) * 2 - 3, 0);
        if (this.controller.pos.getRangeTo(storageCell.storage) < 4)
          body = setups.upgrader.fast.getBody(this.hive.room.energyCapacityAvailable).body;
        else
          body = setups.upgrader.manual.getBody(this.hive.room.energyCapacityAvailable).body;
      }

      let carry = body.filter(b => b === CARRY).length;
      let work = body.filter(b => b === WORK).length
      this.ratePerCreepMax = carry / (suckerTime + carry / work);

      if (this.hive.phase === 2)
        this.maxRate = Math.min(this.maxRate, 15);
      this.master.recalculateTargetBee();
    }
  }

  update() {
    super.update();
    if (!this.link && Game.time % 30 === 7) {
      this.link = <StructureLink>_.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), structure => structure.structureType === STRUCTURE_LINK)[0];
      if (this.link)
        this.recalculateRate();
    }

    if (!this.master.beesAmount)
      return;
    let storageCell = this.hive.cells.storage;
    let freeCap = this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && storageCell && freeCap >= LINK_CAPACITY / 4) {
      this.storageLink = storageCell.getFreeLink();
      if (this.storageLink) {
        if (!storageCell.master.activeBees.length || storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000)
          return;
        storageCell.linksState[this.storageLink.id] = "busy";
        let usedCap = this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY);
        if (freeCap >= usedCap + 50 || freeCap === LINK_CAPACITY - usedCap)
          storageCell.requestFromStorage([this.storageLink], freeCap >= LINK_CAPACITY - 100 ? 3 : 1);
        else
          delete storageCell.requests["link_" + this.storageLink.id];
      }
    }
  }

  run() {
    if (!this.master.beesAmount)
      return;
    if (this.link && this.storageLink) {
      let freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (freeCap <= this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY) || freeCap >= LINK_CAPACITY / 1.05) {
        if (!this.storageLink.cooldown && this.storageLink.transferEnergy(this.link,
          Math.min(freeCap, this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY))) === OK)
          this.storageLink = undefined;
      }
    }
  }
}
