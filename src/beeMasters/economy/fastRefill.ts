import { Master } from "../_Master";
import { setups } from "../../bees/creepSetups";

import { profile } from "../../profiler/decorator";
import type { FastRefillCell } from "../../cells/stage1/fastRefill";

@profile
export class FastRefillMaster extends Master {
  cell: FastRefillCell;
  container: StructureContainer;
  movePriority = 3 as const;
  targetBeeCount = 1;
  pos: RoomPosition;

  constructor(
    fastRefillCell: FastRefillCell,
    container: StructureContainer,
    pos: RoomPosition
  ) {
    super(fastRefillCell.hive, fastRefillCell.ref + "_" + pos.x + "_" + pos.y);
    this.cell = fastRefillCell;
    this.container = container;
    this.pos = pos;
  }

  update() {
    super.update();
    this.container = Game.getObjectById(
      this.container.id
    ) as StructureContainer;
    if (!this.container) {
      this.delete();
      return;
    }
    if (this.checkBees(true)) {
      const setup = setups.queen.copy();
      setup.patternLimit = 6;
      setup.moveMax = 1;
      this.wish({
        setup,
        priority: 1,
      });
    }
  }

  delete() {
    super.delete();
    const index = this.cell.masters.indexOf(this);
    if (index !== -1) this.cell.masters.splice(index);
  }

  run() {
    const lowContainer =
      this.container.store.getUsedCapacity(RESOURCE_ENERGY) <=
      CONTAINER_CAPACITY * 0.7;
    _.forEach(this.activeBees, (bee) => {
      if (!this.pos.equal(bee.pos) && this.pos.isFree(false))
        bee.goTo(this.pos, { range: 0 });
      else if (bee.ticksToLive < 3) {
        bee.transfer(
          this.container.store.getFreeCapacity(RESOURCE_ENERGY)
            ? this.container
            : this.cell.link,
          RESOURCE_ENERGY
        );
      } else {
        const target = this.cell.refillTargets.filter(
          (s) => this.pos.getRangeTo(s) <= 1
        )[0];
        if (!bee.store.getUsedCapacity(RESOURCE_ENERGY)) {
          let suckerTarget: StructureContainer | StructureLink;
          if (this.container.store.getUsedCapacity(RESOURCE_ENERGY) && target)
            suckerTarget = this.container;
          else if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY))
            suckerTarget = this.cell.link;
          else return;
          bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        } else if (target) {
          this.cell.refillTargets.splice(
            this.cell.refillTargets.indexOf(target),
            1
          );
          bee.transfer(target, RESOURCE_ENERGY);
        } else if (lowContainer) bee.transfer(this.container, RESOURCE_ENERGY);
      }
    });
  }
}
