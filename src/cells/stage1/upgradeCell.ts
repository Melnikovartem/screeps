import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { upgraderMaster } from "../../beeMaster/civil/upgrader";
import { profile } from "../../profiler/decorator";

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

    let storageCell = this.hive.cells.storage;
    if (this.link && storageCell && storageCell.link && !storageCell.requests[this.link.id]) {
      storageCell.requests[this.link.id] = {
        ref: this.link.id,
        from: [storageCell.link],
        to: [this.link],
        resource: RESOURCE_ENERGY,
        priority: 4,
      }
    }

    if (!this.beeMaster)
      this.beeMaster = new upgraderMaster(this);
  }

  run() { }
}
