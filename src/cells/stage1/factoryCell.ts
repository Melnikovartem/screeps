import { Cell } from "../_Cell";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "./storageCell";

export const FACTORY_ENERGY = Math.round(FACTORY_CAPACITY * 0.16);

@profile
export class FactoryCell extends Cell {
  factory: StructureFactory;
  roomsToCheck: string[] = [];
  master: undefined;
  sCell: StorageCell;

  constructor(hive: Hive, factory: StructureFactory, sCell: StorageCell) {
    super(hive, prefix.factoryCell + hive.room.name);
    this.sCell = sCell;
    this.factory = factory;
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;

    let balance = this.factory.store.getUsedCapacity(RESOURCE_ENERGY) - FACTORY_ENERGY
    if (balance < 0)
      this.sCell.requestFromStorage([this.factory], 4, RESOURCE_ENERGY, -balance);
  }

  run() {
  }
}
