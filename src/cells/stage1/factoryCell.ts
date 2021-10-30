import { Cell } from "../_Cell";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "./storageCell";

export const FACTORY_ENERGY = Math.round(FACTORY_CAPACITY * 0.16);
export const COMPRESS_MAP = {
  [RESOURCE_HYDROGEN]: RESOURCE_REDUCTANT,
  [RESOURCE_OXYGEN]: RESOURCE_OXIDANT,
  [RESOURCE_UTRIUM]: RESOURCE_UTRIUM_BAR,
  [RESOURCE_LEMERGIUM]: RESOURCE_LEMERGIUM_BAR,
  [RESOURCE_KEANIUM]: RESOURCE_KEANIUM_BAR,
  [RESOURCE_ZYNTHIUM]: RESOURCE_ZYNTHIUM_BAR,
  [RESOURCE_CATALYST]: RESOURCE_PURIFIER,
  [RESOURCE_GHODIUM]: RESOURCE_GHODIUM_MELT,

  [RESOURCE_ENERGY]: RESOURCE_BATTERY,
}

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

    let balance = this.factory.store.getUsedCapacity(RESOURCE_ENERGY) - FACTORY_ENERGY;
    if (balance < 0)
      this.sCell.requestFromStorage([this.factory], 4, RESOURCE_ENERGY, -balance);
    else if (balance > 0)
      this.sCell.requestToStorage([this.factory], 4, RESOURCE_ENERGY, balance);

    for (const r in COMPRESS_MAP) {
      let res = <RESOURCE_HYDROGEN | RESOURCE_OXYGEN>r;
      let hiveState = this.hive.resState[res];
      if (hiveState && hiveState < 0) {
        let decompress = COMPRESS_MAP[res];
        if (this.sCell.getUsedCapacity(decompress) > 100)
          this.sCell.requestFromStorage([this.factory], 4, decompress, Math.floor(this.sCell.getUsedCapacity(decompress) / 100) * 100);
      }
    }
  }

  run() {
    for (const r in COMPRESS_MAP) {
      let decompress = COMPRESS_MAP[<RESOURCE_HYDROGEN | RESOURCE_OXYGEN>r];
      if (this.factory.store.getUsedCapacity(decompress) >= 100)
        this.factory.produce(decompress);
    }
  }
}
