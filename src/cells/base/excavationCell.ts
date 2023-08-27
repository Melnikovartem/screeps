import { HaulerMaster } from "../../beeMasters/economy/hauler";
import type { Hive } from "../../hive/hive";
import { profile } from "../../profiler/decorator";
import { prefix } from "../../static/enums";
import { safeWrap } from "../../static/utils";
import { Cell } from "../_Cell";
import { ResourceCell } from "./resourceCell";

@profile
export class ExcavationCell extends Cell {
  resourceCells: { [id: string]: ResourceCell } = {};
  quitefullCells: ResourceCell[] = [];
  shouldRecalc: boolean = true;
  master: HaulerMaster | undefined;
  roomResources: { [id: string]: number } = {};
  fullContainer = CONTAINER_CAPACITY * 0.9;

  constructor(hive: Hive) {
    super(hive, prefix.excavationCell + "_" + hive.room.name);
    this.initCache("poss", { x: 25, y: 25 });
  }

  get poss(): { x: number; y: number } {
    return this.fromCache("poss");
  }

  get pos(): RoomPosition {
    const pos = this.fromCache("poss");
    return new RoomPosition(pos.x, pos.y, this.hive.roomName);
  }

  addResource(resource: Source | Mineral) {
    if (!this.resourceCells[resource.id]) {
      if (!this.roomResources[resource.pos.roomName])
        this.roomResources[resource.pos.roomName] = 0;
      ++this.roomResources[resource.pos.roomName];
      this.resourceCells[resource.id] = new ResourceCell(
        this.hive,
        resource,
        this
      );
      this.shouldRecalc = true;
    }
  }

  update() {
    _.forEach(this.resourceCells, (cell) =>
      safeWrap(() => cell.update(), cell.print + " update")
    );

    if (!this.master)
      if (this.hive.cells.storage)
        this.master = new HaulerMaster(this, this.hive.cells.storage.storage);
      else return;
    this.quitefullCells = [];

    _.forEach(this.resourceCells, (cell) => {
      if (this.hive.annexInDanger.includes(cell.pos.roomName)) return;
      if (cell.container) {
        let padding = 0;
        if (cell.operational) {
          padding = cell.restTime * cell.master.ratePT + 25;
          if (cell.resource instanceof Source)
            padding = Math.min(padding, cell.resource.energy);
          else padding = Math.min(padding, cell.resource.mineralAmount);
        }
        if (
          cell.lair &&
          (!cell.lair.ticksToSpawn || cell.lair.ticksToSpawn <= cell.restTime)
        )
          padding += 600; // usual drop of source keeper if killed by my SK defender
        if (
          cell.container.store.getUsedCapacity() + padding >=
          this.fullContainer
        ) {
          const roomInfo = Apiary.intel.getInfo(cell.pos.roomName, 20);
          if (roomInfo.safePlace || cell.pos.roomName === this.hive.roomName)
            this.quitefullCells.push(cell);
        }
      }
    });
    this.quitefullCells.sort(
      (a, b) =>
        a.container!.store.getFreeCapacity() -
        b.container!.store.getFreeCapacity()
    );
  }

  run() {
    _.forEach(this.resourceCells, (cell) => {
      safeWrap(() => {
        cell.run();
      }, cell.print + " run");
    });
  }
}
