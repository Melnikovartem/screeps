import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { resourceCell } from "./resourceCell";
import { haulerMaster } from "../beeMaster/hauler";

export class excavationCell extends Cell {
  resourceCells: resourceCell[];
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

    this.quitefullContainers = [];
    _.forEach(this.resourceCells, (cell) => {
      cell.update();

      if (cell.container) {
        if (cell.container.store.getUsedCapacity(RESOURCE_ENERGY) >= 700)
          this.quitefullContainers.push(cell.container);
      }
    });
    this.quitefullContainers.sort(
      (a, b) => a.store.getFreeCapacity(RESOURCE_ENERGY) - b.store.getFreeCapacity(RESOURCE_ENERGY));
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    _.forEach(this.resourceCells, (cell) => {
      cell.run();
    });
  };
}
