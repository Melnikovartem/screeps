import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { upgraderMaster } from "../beeMaster/upgrader"

export class upgradeCell extends Cell {

  controller: StructureController;
  link: StructureLink | undefined;


  constructor(hive: Hive, controller: StructureController) {
    super(hive, "upgradeCell");

    this.controller = controller;

    let link = _.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK);
    if (link instanceof StructureLink) {
      this.link = link;
    }
  }

  update() {
    if (!this.master) {
      this.checkForMaster();
      if (!this.master)
        this.master = new upgraderMaster(this);
    }
  }

  run() { }
}
