import { FastRefillMaster } from "beeMasters/economy/fastRefill";
import { profile } from "profiler/decorator";
import { prefix } from "static/enums";
import { Cell } from "../_Cell";
import type { RespawnCell } from "./../base/respawnCell";

@profile
export class FastRefillCell extends Cell {
  // #region Properties (5)

  private needEnergy = false;
  private parentCell: RespawnCell;

  public link: StructureLink;
  public masters: FastRefillMaster[] = [];
  public refillTargets: (StructureSpawn | StructureExtension)[] = [];

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(parent: RespawnCell, link: StructureLink) {
    super(parent.hive, prefix.fastRefillCell);
    this.link = link;
    this.parentCell = this.hive.cells.spawn;
    for (let dx = -1; dx <= 1; dx += 2)
      for (let dy = -1; dy <= 1; dy += 2) {
        const pos = new RoomPosition(
          link.pos.x + dx,
          link.pos.y + dy,
          link.pos.roomName
        );
        const container = this.pos.findClosest(
          pos
            .findInRange(FIND_STRUCTURES, 1)
            .filter((s) => s.structureType === STRUCTURE_CONTAINER)
        ) as StructureContainer | null;
        if (container)
          this.masters.push(new FastRefillMaster(this, container, pos));
      }
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get parent() {
    return this.hive.cells.spawn;
  }

  public get pos(): RoomPosition {
    return this.link.pos;
  }

  // #endregion Public Accessors (2)

  // #region Private Accessors (1)

  private get sCell() {
    return this.hive.cells.storage!;
  }

  // #endregion Private Accessors (1)

  // #region Public Static Methods (1)

  public static poss(hiveName: string) {
    const cache = Memory.cache.hives[hiveName].cells[prefix.fastRefillCell];
    if (cache && cache.poss) {
      const p = cache.poss as { x: number; y: number };
      return new RoomPosition(p.x, p.y, hiveName);
    }
    return undefined;
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (3)

  public delete() {
    super.delete();
    _.forEach(this.masters, (m) => m.delete());
    this.parentCell.fastRef = undefined;
  }

  public run() {
    if (!this.needEnergy) return;
    if (this.link && this.sCell.link) {
      const freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (
        freeCap >= LINK_CAPACITY * 0.75 &&
        (freeCap <= this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY) ||
          freeCap >= LINK_CAPACITY * 0.9)
      ) {
        const amount = Math.min(
          freeCap,
          this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY)
        );
        if (
          !this.sCell.link.cooldown &&
          this.sCell.link.transferEnergy(this.link, amount) === OK
        )
          Apiary.logger.addResourceStat(
            this.hiveName,
            "upkeep",
            -amount * 0.03,
            RESOURCE_ENERGY
          );
      }
    }
  }

  public update() {
    super.update();
    if (!this.link) this.delete();
    const emptyContainers = this.masters
      .filter(
        (m) =>
          m.container &&
          m.container.store.getUsedCapacity(RESOURCE_ENERGY) <
            CONTAINER_CAPACITY * 0.5
      )
      .map((m) => m.container);
    this.needEnergy = !!emptyContainers.length;
    if (!this.needEnergy) return;
    if (this.sCell.link) {
      if (
        this.link.store.getFreeCapacity(RESOURCE_ENERGY) >=
        LINK_CAPACITY * 0.75
      ) {
        this.sCell.requestFromStorage([this.sCell.link], 1, RESOURCE_ENERGY);
        this.sCell.linkState = {
          using: this.ref,
          priority: 0,
          lastUpdated: Game.time,
        };
      }
    } else this.sCell.requestFromStorage(emptyContainers, 1, RESOURCE_ENERGY); // maybe 0 but for now 1
  }

  // #endregion Public Methods (3)
}
