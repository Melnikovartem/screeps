import { Cell } from "../_Cell";
import { ResourceCell } from "./resourceCell";
import { HaulerMaster } from "../../beeMasters/economy/hauler";

import { safeWrap } from "../../abstract/utils";
import { prefix } from "../../enums";

import { DEVELOPING } from "../../settings";
import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class ExcavationCell extends Cell {
  resourceCells: { [id: string]: ResourceCell } = {};
  quitefullContainers: StructureContainer[] = [];
  shouldRecalc: boolean = true;
  master: HaulerMaster;
  dropOff: StructureStorage // | StructureContainer | StructureLink;
  roomResources: { [id: string]: number } = {};

  constructor(hive: Hive) {
    super(hive, prefix.excavationCell + hive.room.name);
    this.master = new HaulerMaster(this);
    this.dropOff = this.hive.cells.storage!.storage;
  }

  addResource(resource: Source | Mineral) {
    if (!this.resourceCells[resource.id]) {
      if (!this.roomResources[resource.pos.roomName])
        this.roomResources[resource.pos.roomName] = 0;
      ++this.roomResources[resource.pos.roomName];
      this.resourceCells[resource.id] = new ResourceCell(this.hive, resource, this);
      this.shouldRecalc = true;
    }
  }

  update() {
    this.quitefullContainers = [];
    _.forEach(this.resourceCells, cell => {
      safeWrap(() => { cell.update() }, cell.print + " update");

      if (cell.container && cell.operational && (!DEVELOPING || cell.pos.roomName in Game.rooms)) {
        if (cell.container.store.getUsedCapacity() >= 1000) {
          let roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 10);
          if (roomInfo.safePlace)
            this.quitefullContainers.push(cell.container);
        }
      }
    });
    this.quitefullContainers.sort((a, b) => a.store.getFreeCapacity() - b.store.getFreeCapacity());
  };

  run() {
    _.forEach(this.resourceCells, cell => {
      safeWrap(() => { cell.run() }, cell.print + " run");
    });
  };
}
