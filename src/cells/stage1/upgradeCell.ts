import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { upgraderMaster } from "../../beeMasters/economy/upgrader";
import { profile } from "../../profiler/decorator";

@profile
export class upgradeCell extends Cell {

  controller: StructureController;
  link: StructureLink | undefined;
  storageLink: StructureLink | undefined;
  master: upgraderMaster;

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "UpgradeCell_" + hive.room.name);

    this.controller = controller;

    this.link = <StructureLink>_.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), (structure) => structure.structureType === STRUCTURE_LINK)[0];

    if (this.link)
      this.pos = this.link.pos;
    else
      this.pos = this.controller.pos;

    this.master = new upgraderMaster(this);
  }

  update() {
    super.update();
    if (!this.link && Game.time % 30 === 7)
      this.link = <StructureLink>_.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), (structure) => structure.structureType === STRUCTURE_LINK)[0];


    let storageCell = this.hive.cells.storage;
    let freeCap = this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && storageCell && freeCap >= LINK_CAPACITY / 2) {
      this.storageLink = storageCell.getFreeLink();
      if (this.storageLink) {
        if (storageCell.master.manager && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 25000)
          storageCell.linksState[this.storageLink.id] = "busy";
        let usedCap = this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY);
        if (freeCap >= usedCap + 50 || freeCap === LINK_CAPACITY - usedCap)
          storageCell.requestFromStorage("link_" + this.storageLink.id, this.storageLink, 3, undefined, LINK_CAPACITY - usedCap);
        else
          delete storageCell.requests["link_" + this.storageLink.id];
      }
    }
  }

  run() {
    if (this.link && this.storageLink) {
      let freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (freeCap <= this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY) || freeCap >= LINK_CAPACITY / 1.05) {
        if (!this.storageLink.cooldown && this.storageLink.transferEnergy(this.link,
          Math.min(freeCap, this.storageLink.store.getUsedCapacity(RESOURCE_ENERGY))) === OK) {
          if (Apiary.logger)
            Apiary.logger.resourceTransfer(this.hive.roomName, "upgrade", this.storageLink.store, this.link.store, RESOURCE_ENERGY, -1, 0.3);
          this.storageLink = undefined;
        }
      }
    }
  }
}
