import { setups } from "bees/creepSetups";
import type { FastRefillCell } from "cells/spawning/fastRefill";
import { profile } from "profiler/decorator";

import { Master } from "../_Master";

@profile
export class FastRefillMaster extends Master<FastRefillCell> {
  // #region Properties (3)

  public container: StructureContainer;
  public movePriority = 3 as const;
  public posForBee: RoomPosition;

  // #endregion Properties (3)

  // #region Constructors (1)

  public constructor(
    fastRefillCell: FastRefillCell,
    container: StructureContainer,
    posForBee: RoomPosition
  ) {
    super(
      fastRefillCell,
      fastRefillCell.ref + "_" + posForBee.x + "_" + posForBee.y
    );
    this.container = container;
    this.posForBee = posForBee;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public override get pos() {
    return this.posForBee;
  }

  public get targetBeeCount() {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (3)

  public override delete() {
    super.delete();
    const index = this.parent.masters.indexOf(this);
    if (index !== -1) this.parent.masters.splice(index);
  }

  public run() {
    const lowContainer =
      this.container.store.getUsedCapacity(RESOURCE_ENERGY) <=
      CONTAINER_CAPACITY * 0.7;
    _.forEach(this.activeBees, (bee) => {
      if (!this.pos.equal(bee.pos) && this.pos.isFree(true))
        bee.goTo(this.pos, { range: 0 });
      else if (bee.ticksToLive < 3) {
        bee.transfer(
          this.container.store.getFreeCapacity(RESOURCE_ENERGY) ||
            !this.parent.link
            ? this.container
            : this.parent.link,
          RESOURCE_ENERGY
        );
      } else {
        const target = this.parent.refillTargets.filter(
          (s) => this.pos.getRangeTo(s) <= 1
        )[0];
        if (!bee.store.getUsedCapacity(RESOURCE_ENERGY)) {
          let suckerTarget: StructureContainer | StructureLink;
          if (this.container.store.getUsedCapacity(RESOURCE_ENERGY) && target)
            suckerTarget = this.container;
          else if (
            this.parent.link &&
            this.parent.link.store.getUsedCapacity(RESOURCE_ENERGY)
          )
            suckerTarget = this.parent.link;
          else return;
          bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        } else if (target) {
          this.parent.refillTargets.splice(
            this.parent.refillTargets.indexOf(target),
            1
          );
          bee.transfer(target, RESOURCE_ENERGY);
        } else if (lowContainer) bee.transfer(this.container, RESOURCE_ENERGY);
      }
    });
  }

  public override update() {
    super.update();
    this.container = Game.getObjectById(
      this.container.id
    ) as StructureContainer;
    if (!this.container) {
      this.delete();
      return;
    }
    if (this.checkBees(true)) {
      const setup = setups.fastRefill.copy();
      this.wish({
        setup,
        priority: 1,
      });
    }
  }

  // #endregion Public Methods (3)
}
