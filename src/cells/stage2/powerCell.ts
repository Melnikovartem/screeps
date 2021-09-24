import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";

@profile
export class PowerCell extends Cell {
  powerSpawn: StructurePowerSpawn;
  roomsToCheck: string[] = [];

  constructor(hive: Hive, powerSpawn: StructurePowerSpawn) {
    super(hive, prefix.powerCell + hive.room.name);
    this.powerSpawn = powerSpawn;
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;
    let storageCell = this.hive.cells.storage;
    if (!storageCell)
      return;

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > POWER_SPAWN_POWER_CAPACITY / 2 && storageCell.storage.store.getCapacity(RESOURCE_POWER) > 0)
      storageCell.requestFromStorage("power_" + this.powerSpawn.id, this.powerSpawn, 5, RESOURCE_POWER);

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_CAPACITY / 2)
      storageCell.requestFromStorage("energy_" + this.powerSpawn.id, this.powerSpawn, 5, RESOURCE_ENERGY);
  }

  run() {
    if (this.powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 && this.powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_RATIO)
      this.powerSpawn.processPower();
  }
}
