import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { resourceCell } from "./resourceCell";
import { haulerMaster } from "../beeMaster/hauler";

export class excavationCell extends Cell {
  resourceCells: resourceCell[];
  fullContainers: StructureContainer[] = [];
  quitefullContainers: StructureContainer[] = [];

  constructor(hive: Hive, sources: Source[]) {
    super(hive, "excavationCell_" + hive.room.name);

    this.resourceCells = [];
    _.forEach(sources, (source) => {
      this.resourceCells.push(new resourceCell(this.hive, source));
    });
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    // super.update(); // i update continers in each resourceCell

    if (!this.beeMaster)
      this.beeMaster = new haulerMaster(this);

    this.fullContainers = [];
    this.quitefullContainers = [];
    _.forEach(this.resourceCells, (cell) => {
      cell.update();

      if (cell.container) {
        if (cell.container.store.getUsedCapacity(RESOURCE_ENERGY) >= 1500)
          this.fullContainers.push(cell.container);
        else if (cell.container.store.getUsedCapacity(RESOURCE_ENERGY) >= 500)
          this.quitefullContainers.push(cell.container);
      }
    });
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    _.forEach(this.resourceCells, (cell) => {
      cell.run();
    });
  };
}