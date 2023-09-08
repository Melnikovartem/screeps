import { HaulerMaster } from "beeMasters/economy/hauler";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { prefix } from "static/enums";

import { Cell } from "../_Cell";
import { ResourceCell } from "./resourceCell";

@profile
export class ExcavationCell extends Cell {
  // #region Properties (7)

  private roomResources: { [id: string]: number } = {};

  public fullContainer = CONTAINER_CAPACITY * 0.9;
  public override master: HaulerMaster | undefined;
  public poss: { x: number; y: number };
  public quitefullCells: ResourceCell[] = [];
  public resourceCells: { [id: string]: ResourceCell } = {};
  /** recals the amount of haulers needed to bring stuff from sources */
  public shouldRecalc: boolean = true;

  // #endregion Properties (7)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.excavationCell);
    // @todo smth smarter for rest pos base
    const pos =
      this.hive.room.storage?.pos ||
      _.filter(Game.spawns, (sp) => sp.pos.roomName === hive.roomName)[0]
        ?.pos ||
      this.hive.controller.pos;
    this.poss = this.cache("poss") || {
      x: Math.max(Math.min(50 - pos.x, 45), 15),
      y: Math.max(Math.min(50 - pos.x, 45), 15),
    };
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public override get pos(): RoomPosition {
    return new RoomPosition(this.poss.x, this.poss.y, this.hiveName);
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (3)

  public addResource(resource: Source | Mineral) {
    if (this.resourceCells[resource.id]) return; // failsafe
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

  public run() {
    _.forEach(this.resourceCells, (cell) =>
      Apiary.wrap(() => cell.run(), cell.print, "run", 0)
    );
  }

  public update() {
    _.forEach(this.resourceCells, (cell) =>
      Apiary.wrap(() => cell.update(), cell.print, "update", 0)
    );

    if (!this.master)
      if (this.hive.storage instanceof StructureStorage)
        this.master = new HaulerMaster(this, this.hive.storage);
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
          else padding = Math.min(padding, cell.resourceCapacity);
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
          if (roomInfo.safePlace || cell.pos.roomName === this.hiveName)
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

  // #endregion Public Methods (3)
}
