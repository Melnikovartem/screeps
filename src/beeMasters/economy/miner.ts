import type { resourceCell } from "../../cells/stage1/resourceCell";

import { Setups } from "../../bees/creepSetups";
import { Master, states } from "../_Master";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class minerMaster extends Master {
  cell: resourceCell;
  cooldown: number = 0;

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);
    if (this.checkBees() && this.cell.perSecondNeeded > 0 && roomInfo.safePlace && this.cell.operational) {
      let order: SpawnOrder = {
        setup: Setups.miner.energy,
        amount: 1,
        priority: 2,
      };

      if (this.cell.resourceType !== RESOURCE_ENERGY) {
        order.setup = Setups.miner.minerals;
        order.priority = 6;
      } else if (this.cell.pos.roomName !== this.hive.roomName)
        order.priority = 5;

      this.wish(order);
    }
  }

  run() {
    let sourceOff = this.cell.resource instanceof Source && this.cell.resource.energy === 0
      || this.cell.extractor && (this.cell.extractor.cooldown > 0 || this.cell.perSecondNeeded === 0)
      || !this.cell.operational;
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === states.work && sourceOff)
        bee.state = states.chill;

      switch (bee.state) {
        case states.work:
          if (this.cell.pos.isFree() && bee.pos.isNearTo(this.cell.pos))
            bee.goTo(this.cell.pos);
          bee.harvest(this.cell.resource);
          if (bee.creep.store[this.cell.resourceType] < 25)
            break;

          let target;
          if (this.cell.link && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.link;
          else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.container;
          bee.transfer(target, this.cell.resourceType);
          if (target)
            break;

        case states.chill:
          if (bee.goRest(this.cell.pos) === OK && this.cell.resourceType === RESOURCE_ENERGY) {
            let target = this.cell.container;
            if (target && target.hits < target.hitsMax) {
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
                bee.repair(target);
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) < 24 && target.store.getUsedCapacity(RESOURCE_ENERGY) >= 18)
                bee.withdraw(target, RESOURCE_ENERGY, 18);
            }
          }
          bee.state = states.work;
          break;
        case states.flee:
          if (this.cell.container && bee.pos.isNearTo(this.cell.container))
            bee.transfer(this.cell.container, RESOURCE_ENERGY);
          let lair = this.cell.pos.findInRange(FIND_STRUCTURES, 5, { filter: { structureType: STRUCTURE_KEEPER_LAIR } })[0];
          if (lair && lair.pos.getRangeTo(bee) < 6)
            bee.goTo(this.hive.pos);
          bee.state = states.work;
          break;
      }
    });
  }
}
