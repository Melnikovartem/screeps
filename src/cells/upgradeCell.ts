import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { upgraderMaster } from "../beeMaster/civil/upgrader";
import { profile } from "../profiler/decorator";

@profile
export class upgradeCell extends Cell {

  controller: StructureController;
  link: StructureLink | undefined;

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "UpgradeCell_" + hive.room.name);

    this.controller = controller;

    let link = _.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3), (structure) => structure.structureType == STRUCTURE_LINK)[0];
    if (link instanceof StructureLink) {
      this.link = link;
    }

    if (this.link)
      this.pos = this.link.pos;
    else
      this.pos = this.controller.pos;
  }

  update() {
    super.update();
    if (!this.beeMaster)
      this.beeMaster = new upgraderMaster(this);

    let storageCell = this.hive.cells.storageCell;
    if (this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY) > LINK_CAPACITY / 4
      && storageCell && storageCell.link && (!storageCell.requests[this.link.id]
        || this.link.store.getFreeCapacity(RESOURCE_ENERGY) - storageCell.requests[this.link.id].amount! >= 25))
      storageCell.requests[this.link.id] = {
        from: storageCell.link,
        to: this.link,
        resource: RESOURCE_ENERGY,
        amount: this.link.store.getFreeCapacity(RESOURCE_ENERGY),
        priority: 4
      }
  }

  run() { }
}
