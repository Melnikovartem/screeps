import { Cell } from "./_Cell";
import { Hive } from "../Hive";

// import { bootstrapMaster } from "../beeMaster/bootstrap"

export class developmentCell extends Cell {

  controller: StructureController;
  link: StructureLink | undefined;


  constructor(hive: Hive, controller: StructureController) {
    super(hive, "developmentCell_" + hive.room.name);

    this.controller = controller;

    let link = _.filter(this.controller.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK);
    if (link instanceof StructureLink) {
      this.link = link;
    }
  }

  update() {
    super.update();
    //if (!this.master)
    // this.master = new bootstrapMaster(this);
  }

  run() { }
}
