import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { resourceCell } from "./resourceCell";
import { haulerMaster } from "../../beeMaster/civil/hauler";
import { profile } from "../../profiler/decorator";

@profile
export class excavationCell extends Cell {
  resourceCells: resourceCell[];
  quitefullContainers: StructureContainer[] = [];

  constructor(hive: Hive, sources: Source[], minerals: Mineral[]) {
    super(hive, "ExcavationCell_" + hive.room.name);

    this.resourceCells = [];
    _.forEach(sources, (source) => {
      this.resourceCells.push(new resourceCell(this.hive, source));
    });

    _.forEach(minerals, (mineral) => {
      this.resourceCells.push(new resourceCell(this.hive, mineral));
    });
  }

  update() {
    this.quitefullContainers = [];
    _.forEach(this.resourceCells, (cell) => {
      if (cell.operational)
        cell.update();

      if (cell.container) {
        if (cell.container.store.getUsedCapacity() >= 700) {
          let roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 10);
          if (roomInfo.safePlace)
            this.quitefullContainers.push(cell.container);
        }
      }
    });
    this.quitefullContainers.sort(
      (a, b) => a.store.getFreeCapacity() - b.store.getFreeCapacity());

    if (!this.beeMaster)
      this.beeMaster = new haulerMaster(this);
  };

  run() {
    _.forEach(this.resourceCells, (cell) => {
      if (cell.operational)
        cell.run();
    });
  };
}
