import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { bootstrapMaster } from "../../beeMasters/economy/bootstrap";
import { profile } from "../../profiler/decorator";

@profile
export class developmentCell extends Cell {

  controller: StructureController;
  sources: { [id: string]: Source } = {};
  master: bootstrapMaster;
  shouldRecalc: boolean = true;

  constructor(hive: Hive) {
    super(hive, "DevelopmentCell_" + hive.room.name);
    this.controller = this.hive.room.controller!;
    this.master = new bootstrapMaster(this);
  }

  addResource(resource: Source) {
    if (!this.sources[resource.id]) {
      this.sources[resource.id] = resource;
      this.shouldRecalc = true;
    }
  }

  update() {
    super.update(["sources"]);
  }

  run() { }
}
