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
  handAddedResources: RoomPosition[] = [];

  constructor(hive: Hive) {
    super(hive, "DevelopmentCell_" + hive.room.name);
    this.controller = this.hive.room.controller!;
    this.master = new bootstrapMaster(this);

    _.forEach(this.hive.room.find(FIND_DROPPED_RESOURCES), (r) => {
      if (r.resourceType === RESOURCE_ENERGY)
        this.handAddedResources.push(r.pos);
    });

    _.forEach(this.hive.room.find(FIND_STRUCTURES), (s) => {
      if (s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
        this.handAddedResources.push(s.pos);
    });
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
