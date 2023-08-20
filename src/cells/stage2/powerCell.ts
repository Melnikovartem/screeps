import { Cell } from "../_Cell";

import { hiveStates, prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "../stage1/storageCell";
import type { PowerBee } from "../../bees/powerBee";

@profile
export class PowerCell extends Cell {
  powerSpawn: StructurePowerSpawn;
  roomsToCheck: string[] = [];
  master: undefined;
  sCell: StorageCell;

  constructor(hive: Hive, powerSpawn: StructurePowerSpawn, sCell: StorageCell) {
    super(hive, prefix.powerCell + "_" + hive.room.name);
    this.sCell = sCell;
    this.powerSpawn = powerSpawn;
    this.setCahe("poss", { x: 25, y: 25 });
  }

  get poss(): { x: number, y: number } {
    return this.fromCache("poss");
  }

  get pos(): RoomPosition {
    let pos = this.fromCache("poss");
    return new RoomPosition(pos.x, pos.y, this.hive.roomName);
  }

  get powerManager(): string | undefined {
    return this.fromCache("powerManager");
  }

  set powerManager(value) {
    this.toCache("powerManager", value);
  }

  get powerManagerBee(): PowerBee | undefined {
    return <PowerBee | undefined>(this.powerManager && Apiary.bees[this.powerManager]);
  }

  update() {
    super.update();
    if (!this.powerSpawn) {
      this.delete()
      return;
    }

    this.roomsToCheck = this.hive.annexNames;

    if (this.hive.state !== hiveStates.economy || this.hive.resState[RESOURCE_ENERGY] < 0 || !this.hive.shouldDo("powerRefining"))
      return;

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > POWER_SPAWN_POWER_CAPACITY / 2)
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_POWER);
    else {
      let req = this.sCell.requests[this.powerSpawn.id]
      if (req && req.resource === RESOURCE_POWER)
        delete this.sCell.requests[this.powerSpawn.id];
    }

    if (this.powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_CAPACITY / 2)
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_ENERGY);
    else {
      let req = this.sCell.requests[this.powerSpawn.id];
      if (req && req.resource === RESOURCE_ENERGY)
        delete this.sCell.requests[this.powerSpawn.id];
    }
  }

  run() {
    if (this.powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 && this.powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) > POWER_SPAWN_ENERGY_RATIO)
      if (this.powerSpawn.processPower() == OK && Apiary.logger) {
        Apiary.logger.addResourceStat(this.hive.roomName, "power_upgrade", -1, RESOURCE_POWER)
        Apiary.logger.addResourceStat(this.hive.roomName, "power_upgrade", -1 * POWER_SPAWN_ENERGY_RATIO, RESOURCE_ENERGY)
      }
  }
}
