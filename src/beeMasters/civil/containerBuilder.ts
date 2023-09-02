import type { MovePriority } from "beeMasters/_Master";
import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class ContainerBuilderMaster extends SwarmMaster<undefined> {
  // #region Properties (1)

  public override movePriority: MovePriority = 5;

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public override get maxSpawns(): number {
    return 3;
  }

  public override get targetBeeCount(): number {
    return 3;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    let target: { pos: RoomPosition } =
      Game.rooms[this.pos.roomName] &&
      this.pos
        .lookFor(LOOK_CONSTRUCTION_SITES)
        .filter((c) => c.structureType === STRUCTURE_CONTAINER)[0];
    if (!target) {
      this.pos.createConstructionSite(STRUCTURE_CONTAINER);
      target = { pos: this.pos };
    }
    const sCell = this.hive.cells.storage!;
    if (!sCell) return;
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill:
          bee.state = beeStates.refill;
        // fall through
        case beeStates.refill: {
          const otherRes =
            bee.store.getUsedCapacity() >
            bee.store.getUsedCapacity(RESOURCE_ENERGY);
          if (otherRes) {
            const res = Object.keys(bee.store).filter(
              (r) => r !== RESOURCE_ENERGY
            )[0] as ResourceConstant | undefined;
            if (res && bee.transfer(sCell.storage, res) === OK)
              Apiary.logger.resourceTransfer(
                this.hiveName,
                "pickup",
                bee.store,
                sCell.storage.store,
                res,
                1
              );
          }
          if (
            bee.withdraw(sCell.storage, RESOURCE_ENERGY, undefined) === OK &&
            !otherRes
          ) {
            bee.state = beeStates.work;

            Apiary.logger.resourceTransfer(
              this.hiveName,
              "build",
              sCell.storage.store,
              bee.store
            );
            bee.goTo(target.pos);
            break;
          }
          const resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
          if (resource) bee.pickup(resource);
          break;
        }
        case beeStates.work: {
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          } else {
            if (target instanceof ConstructionSite) bee.build(target);
            let resource;
            if (bee.pos.getRangeTo(target) <= 3) {
              resource = bee.pos.findClosest(
                target.pos.findInRange(FIND_DROPPED_RESOURCES, 3)
              );
            } else resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
            if (resource) bee.pickup(resource);
          }
          break;
        }
      }
      if (this.checkFlee(bee, this.hive)) return;
    });
  }

  public override update() {
    super.update();
    const room = Game.rooms[this.pos.roomName];
    if (
      room &&
      this.pos
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === STRUCTURE_CONTAINER).length
    ) {
      const anotherContainer = room
        .find(FIND_MY_CONSTRUCTION_SITES)
        .filter((c) => c.structureType === STRUCTURE_CONTAINER)[0];
      if (anotherContainer) this.parent.setPosition(anotherContainer.pos);
      else this.parent.delete();
      return;
    }
    if (
      this.checkBees() &&
      Apiary.intel.getInfo(this.pos.roomName).safePlace &&
      this.hive.cells.storage
    ) {
      const setup = setups.builder.copy();
      setup.pattern = [WORK, CARRY, CARRY];
      setup.moveMax = 50 / 3;
      this.wish({
        setup,
        priority: 5,
      });
    }
  }

  // #endregion Public Methods (2)

  // #region Protected Methods (1)

  protected override defaultInfo(): undefined {
    return undefined;
  }

  // #endregion Protected Methods (1)
}
