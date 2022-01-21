import { Cell } from "../_Cell";
import { FastRefillMaster } from "../../beeMasters/economy/fastRefill";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { RespawnCell } from "./../base/respawnCell";
import type { StorageCell } from "./storageCell";

@profile
export class FastRefillCell extends Cell {

  link: StructureLink;
  parentCell: RespawnCell;
  masters: FastRefillMaster[] = [];
  refillTargets: (StructureSpawn | StructureExtension)[] = [];
  sCell: StorageCell;
  needEnergy = false;

  constructor(parent: RespawnCell, link: StructureLink, sCell: StorageCell) {
    super(parent.hive, prefix.fastRefillCell + "_" + parent.hive.room.name);
    this.sCell = sCell;
    this.link = link;
    this.parentCell = this.hive.cells.spawn;
    this.setCahe("poss", { x: link.pos.x, y: link.pos.y });
    for (let dx = -1; dx <= 1; dx += 2)
      for (let dy = -1; dy <= 1; dy += 2) {
        let pos = new RoomPosition(link.pos.x + dx, link.pos.y + dy, link.pos.roomName);
        let container = <StructureContainer | null>this.pos.findClosest(pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTAINER));
        if (container)
          this.masters.push(new FastRefillMaster(this, container, pos));
      }
  }

  get poss(): { x: number, y: number } {
    return this.fromCache("poss");
  }

  get pos(): RoomPosition {
    let pos = this.fromCache("poss");
    return new RoomPosition(pos.x, pos.y, this.hive.roomName);
  }

  delete() {
    super.delete();
    _.forEach(this.masters, m => m.delete());
    this.parentCell.fastRef = undefined;
  }

  update() {
    super.update();
    if (!this.link)
      this.delete();
    let emptyContainers = <StructureContainer[]>this.masters
      .filter(m => m.container && m.container.store.getUsedCapacity(RESOURCE_ENERGY) < CONTAINER_CAPACITY * 0.5).map(m => m.container);
    this.needEnergy = !!emptyContainers.length;
    if (!this.needEnergy)
      return;
    if (this.sCell.link) {
      if (this.link.store.getFreeCapacity(RESOURCE_ENERGY) >= LINK_CAPACITY * 0.75) {
        this.sCell.requestFromStorage([this.sCell.link], 1, RESOURCE_ENERGY);
        this.sCell.linkState = 1;
      }
    } else
      this.sCell.requestFromStorage(emptyContainers, 1, RESOURCE_ENERGY); // maybe 0 but for now 1
  }

  run() {
    if (!this.needEnergy)
      return;
    if (this.link && this.sCell.link) {
      let freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (freeCap >= LINK_CAPACITY * 0.75 && (freeCap <= this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY) || freeCap >= LINK_CAPACITY * 0.9)) {
        let amount = Math.min(freeCap, this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY));
        if (!this.sCell.link.cooldown && this.sCell.link.transferEnergy(this.link, amount) === OK)
          if (Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "upkeep", -amount * 0.03);
      }
    }
  }
}
