import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { bootstrapMaster } from "../../beeMaster/civil/bootstrap";
import { profile } from "../../profiler/decorator";

@profile
export class developmentCell extends Cell {

  controller: StructureController;
  sources: Source[];

  constructor(hive: Hive, controller: StructureController, sources: Source[]) {
    super(hive, "DevelopmentCell_" + hive.room.name);

    this.controller = controller;
    this.sources = sources;
  }

  update() {
    super.update();
    if (!this.beeMaster)
      this.beeMaster = new bootstrapMaster(this);
  }
  run() { }
}