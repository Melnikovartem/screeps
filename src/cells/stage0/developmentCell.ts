import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { bootstrapMaster } from "../../beeMasters/economy/bootstrap";
import { profile } from "../../profiler/decorator";

@profile
export class developmentCell extends Cell {

  controller: StructureController;
  sources: { [id: string]: Source } = {};

  constructor(hive: Hive) {
    super(hive, "DevelopmentCell_" + hive.room.name);

    this.controller = this.hive.room.controller!;
  }

  addResource(resource: Source) {
    if (!this.sources[resource.id]) {
      this.sources[resource.id] = resource;
      if (this.master)
        (<bootstrapMaster>this.master).recalculateTargetBee();
    }
  }

  update() {
    super.update(["sources"]);
    if (!this.master)
      this.master = new bootstrapMaster(this);
  }
  run() { }
}
