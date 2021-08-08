import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { bootstrapMaster } from "../beeMaster/bootstrap";

export class developmentCell extends Cell {

  controller: StructureController;
  sources: Source[];


  constructor(hive: Hive, controller: StructureController, sources: Source[]) {
    super(hive, "developmentCell_" + hive.room.name);

    this.controller = controller;
    this.sources = sources;
  }

  update() {
    super.update();
    if (!this.beeMaster)
      this.beeMaster = new bootstrapMaster(this);

    // delete when reached state of storage? rn it will just fade with vr recreation
  }

  run() { }
}
