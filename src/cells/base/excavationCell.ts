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
  quitefullCells: ResourceCell[] = [];
  shouldRecalc: boolean = true;
  master: HaulerMaster | undefined;
  roomResources: { [id: string]: number } = {};
  fullContainer = CONTAINER_CAPACITY * 0.9;

  constructor(hive: Hive) {
    super(hive, prefix.excavationCell + hive.room.name);
  }

  get pos() {
    return this.hive.rest;
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
    _.forEach(this.resourceCells, cell => safeWrap(() => cell.update(), cell.print + " update"));

    if (!this.master)
      if (this.hive.cells.storage)
        this.master = new HaulerMaster(this, this.hive.cells.storage.storage);
      else
        return;
    this.quitefullCells = [];

    _.forEach(this.resourceCells, cell => {
      if (cell.container && cell.operational && (!DEVELOPING || cell.pos.roomName in Game.rooms)) {
        let padding;
        padding = cell.restTime * cell.ratePT + 100;
        if (cell.resource instanceof Source)
          padding = Math.min(cell.resource.energy, padding);
        if (!cell.master.activeBees.filter(b => b.pos.isNearTo(cell)).length)
          padding = 0;
        if (cell.container.store.getUsedCapacity() + padding >= this.fullContainer) {
          let roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 10);
          if (roomInfo.safePlace || cell.pos.roomName === this.hive.roomName)
            this.quitefullCells.push(cell);
        }
      }
    });
    this.quitefullCells.sort((a, b) => a.container!.store.getFreeCapacity() - b.container!.store.getFreeCapacity());
  }

  run() {
    _.forEach(this.resourceCells, cell => {
      safeWrap(() => { cell.run() }, cell.print + " run");
    });
  }
}
