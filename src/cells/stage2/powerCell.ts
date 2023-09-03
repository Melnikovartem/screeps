import type { PowerBee } from "bees/powerBee";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";

import { Cell } from "../_Cell";

@profile
export class PowerCell extends Cell {
  // #region Properties (4)

  public _powerManager: string | null = this.cache("_powerManager");
  public poss: { x: number; y: number };
  public powerSpawn: StructurePowerSpawn;

  // #endregion Properties (4)

  // #region Constructors (1)

  public constructor(hive: Hive, powerSpawn: StructurePowerSpawn) {
    super(hive, prefix.powerCell);
    this.powerSpawn = powerSpawn;
    this.poss = this.cache("poss") || this.powerSpawn.pos;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (5)

  public override get pos(): RoomPosition {
    return new RoomPosition(this.poss.x, this.poss.y, this.hiveName);
  }

  public get powerManager() {
    return this._powerManager;
  }

  public set powerManager(value) {
    this._powerManager = this.cache("_powerManager", value);
  }

  public get powerManagerBee(): PowerBee | undefined {
    return (this.powerManager && Apiary.bees[this.powerManager]) as
      | PowerBee
      | undefined;
  }

  // #endregion Public Accessors (5)

  // #region Public Methods (2)

  public run() {
    if (
      this.powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 &&
      this.powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) >
        POWER_SPAWN_ENERGY_RATIO
    )
      if (this.powerSpawn.processPower() === OK) {
        Apiary.logger.addResourceStat(
          this.hiveName,
          "power_upgrade",
          -1,
          RESOURCE_POWER
        );
        Apiary.logger.addResourceStat(
          this.hiveName,
          "power_upgrade",
          -1 * POWER_SPAWN_ENERGY_RATIO,
          RESOURCE_ENERGY
        );
      }
  }

  public override update() {
    this.updateObject();
    if (!this.powerSpawn) {
      this.delete();
      return;
    }

    if (
      this.hive.state !== hiveStates.economy ||
      this.hive.resState[RESOURCE_ENERGY] < 0 ||
      !this.hive.mode.powerRefining
    )
      return;

    if (
      this.powerSpawn.store.getFreeCapacity(RESOURCE_POWER) >
      POWER_SPAWN_POWER_CAPACITY / 2
    )
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_POWER);
    else {
      const req = this.sCell.requests[this.powerSpawn.id];
      if (req && req.resource === RESOURCE_POWER)
        delete this.sCell.requests[this.powerSpawn.id];
    }

    if (
      this.powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) >
      POWER_SPAWN_ENERGY_CAPACITY / 2
    )
      this.sCell.requestFromStorage([this.powerSpawn], 5, RESOURCE_ENERGY);
    else {
      const req = this.sCell.requests[this.powerSpawn.id];
      if (req && req.resource === RESOURCE_ENERGY)
        delete this.sCell.requests[this.powerSpawn.id];
    }
  }

  // #endregion Public Methods (2)
}
