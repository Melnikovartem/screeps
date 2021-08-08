import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { resourceCell } from "./resourceCell";

export class excavationCell extends Cell {
  resourceCells: resourceCell[];

  constructor(hive: Hive, sources: Source[]) {
    super(hive, "excavationCell_" + hive.room.name);

    this.resourceCells = [];
    _.forEach(sources, (source) => {
      this.resourceCells.push(new resourceCell(this.hive, source));
    });
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    super.update();
    _.forEach(this.resourceCells, (cell) => {
      cell.update();
    });
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    _.forEach(this.resourceCells, (cell) => {
      cell.run();
    });
  };
}
