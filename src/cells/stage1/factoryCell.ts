import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";

export const FACTORY_ENERGY = Math.round(FACTORY_CAPACITY * 0.16);

@profile
export class FactoryCell extends Cell {
  factory: StructureFactory;
  roomsToCheck: string[] = [];
  master: undefined;

  constructor(hive: Hive, factory: StructureFactory) {
    super(hive, prefix.factoryCell + hive.room.name);
    this.factory = factory;
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;
    let storageCell = this.hive.cells.storage;
    if (!storageCell)
      return;

    let balance = this.factory.store.getUsedCapacity(RESOURCE_ENERGY) - FACTORY_ENERGY
    if (balance < 0)
      storageCell.requestFromStorage([this.factory], 4, RESOURCE_ENERGY, -balance);
  }

  run() {
  }
}
