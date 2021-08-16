import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { resourceCell } from "./resourceCell";
import { haulerMaster } from "../../beeMaster/economy/hauler";
import { safeWrap } from "../../utils";
import { profile } from "../../profiler/decorator";
@profile
export class excavationCell extends Cell {
  resourceCells: { [id: string]: resourceCell } = {};
  quitefullContainers: StructureContainer[] = [];
  shouldRecalc = true;

  constructor(hive: Hive) {
    super(hive, "ExcavationCell_" + hive.room.name);
  }

  addResource(resource: Source | Mineral) {
    if (!this.resourceCells[resource.id]) {
      this.resourceCells[resource.id] = new resourceCell(this.hive, resource);
      if (this.beeMaster)
        (<haulerMaster>this.beeMaster).recalculateTargetBee();
    }
  }

  update() {
    this.quitefullContainers = [];
    _.forEach(this.resourceCells, (cell) => {
      if (cell.operational)
        safeWrap(() => { cell.update() }, "update " + cell.print);

      if (cell.container && cell.operational) {
        if (cell.container.store.getUsedCapacity() >= 700) {
          let roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 10);
          if (roomInfo.safePlace)
            this.quitefullContainers.push(cell.container);
        }
      }
    });
    this.quitefullContainers.sort((a, b) => a.store.getFreeCapacity() - b.store.getFreeCapacity());

    if (!this.beeMaster)
      this.beeMaster = new haulerMaster(this);
  };

  run() {
    _.forEach(this.resourceCells, (cell) => {
      if (cell.operational)
        safeWrap(() => { cell.run() }, "run " + cell.print);
    });
  };
}
