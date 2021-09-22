import { Cell } from "../_Cell";
import { BootstrapMaster } from "../../beeMasters/economy/bootstrap";

import { hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class DevelopmentCell extends Cell {

  controller: StructureController;
  sources: { [id: string]: Source } = {};
  master: BootstrapMaster;
  shouldRecalc: boolean = true;
  handAddedResources: RoomPosition[] = [];

  constructor(hive: Hive) {
    super(hive, "DevelopmentCell_" + hive.room.name);
    this.controller = this.hive.room.controller!;
    this.master = new BootstrapMaster(this);

    _.forEach(this.hive.room.find(FIND_DROPPED_RESOURCES), (r) => {
      if (r.resourceType === RESOURCE_ENERGY)
        this.handAddedResources.push(r.pos);
    });

    _.forEach(this.hive.room.find(FIND_STRUCTURES), (s) => {
      if (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK)
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
    super.update(["sources"], false);
    if (this.hive.room.storage && this.hive.stage === 0)
      Apiary.destroyTime = Game.time;
  }

  run() {
    if (!this.master.beesAmount && this.hive.stage > 0 && this.hive.state === hiveStates.economy)
      Apiary.destroyTime = Game.time;
  }
}
