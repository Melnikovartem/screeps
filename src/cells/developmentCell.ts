import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { bootstrapMaster } from "../beeMaster/civil/bootstrap";
import { UPDATE_EACH_TICK } from "../settings";
import { profile } from "../profiler/decorator";

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

    // caustom-made update for sources for developmentCell
    if (UPDATE_EACH_TICK || Game.time % 5 == 4)
      _.forEach(this.sources, (source, key) => {
        let sourceNew = Game.getObjectById(source.id);
        if (sourceNew instanceof Source)
          this.sources[key] = sourceNew;
      });

    if (!this.beeMaster)
      this.beeMaster = new bootstrapMaster(this);

    // delete when reached state of storage? rn it will just fade with vr recreation
  }

  run() { }
}
