import { FastRefillMaster } from "../../beeMasters/economy/fastRefill";
import { profile } from "../../profiler/decorator";
import { prefix } from "../../static/enums";
import { Cell } from "../_Cell";
import type { RespawnCell } from "./../base/respawnCell";

@profile
export class FastRefillCell extends Cell {
  public link: StructureLink;
  private parentCell: RespawnCell;
  public masters: FastRefillMaster[] = [];
  public refillTargets: (StructureSpawn | StructureExtension)[] = [];
  private needEnergy = false;

  public constructor(parent: RespawnCell, link: StructureLink) {
    super(parent.hive, prefix.fastRefillCell);
    if (!this.sCell) this.delete();
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

  public get parent() {
    return this.hive.cells.spawn;
  }

  public get sCell() {
    return this.hive.cells.storage!;
  }

  public get pos(): RoomPosition {
    return this.link.pos;
  }

  public delete() {
    super.delete();
    _.forEach(this.masters, (m) => m.delete());
    this.parentCell.fastRef = undefined;
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
          if (Apiary.logger)
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "upkeep",
              -amount * 0.03,
              RESOURCE_ENERGY
            );
      }
    }
  }
}
