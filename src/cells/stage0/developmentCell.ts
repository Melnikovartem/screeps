import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { bootstrapMaster } from "../../beeMasters/economy/bootstrap";
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

  addResource(resource: Source) {
    if (!this.sources.includes(resource)) {
      this.sources.push(resource);
      if (this.master)
        (<bootstrapMaster>this.master).recalculateTargetBee();
    }
  }

  update() {
    super.update();
    if (!this.master)
      this.master = new bootstrapMaster(this);
  }
  run() { }
}
