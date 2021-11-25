import { Cell } from "../_Cell";

import { hiveStates, prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "../stage1/storageCell";

@profile
export class PowerCell extends Cell {
  powerSpawn: StructurePowerSpawn;
  roomsToCheck: string[] = [];
  master: undefined;
  sCell: StorageCell;

  constructor(hive: Hive, powerSpawn: StructurePowerSpawn, sCell: StorageCell) {
    super(hive, prefix.powerCell + hive.room.name);
    this.sCell = sCell;
    this.powerSpawn = powerSpawn;
  }

  get powerManager(): string | undefined {
    return this.fromCache("powerManager");
  }

  set powerManager(value) {
    this.toCache("powerManager", value);
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;

    if (this.hive.state !== hiveStates.economy)
      return;

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > POWER_SPAWN_POWER_CAPACITY / 2)
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_POWER);

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_CAPACITY / 2)
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_ENERGY);
  }

  run() {
    if (this.powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 && this.powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_RATIO)
      this.powerSpawn.processPower();
  }
}
