import { resourceCell } from "../../cells/stage1/resourceCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master, states } from "../_Master";
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
    if (this.cell.operational)
      _.forEach(this.bees, (bee) => {
        bee.state = states.work;
        if (this.cell.resource instanceof Source && this.cell.resource.energy === 0)
          bee.state = states.chill;
        if (this.cell.extractor && (this.cell.extractor.cooldown > 0 || this.cell.perSecondNeeded === 0))
          bee.state = states.chill;
        if ((this.cell.link && this.cell.link.store.getFreeCapacity(this.cell.resourceType) === 0)
          || (!this.cell.link && this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType) === 0))
          bee.state = states.chill;

        if (bee.state === states.work) {
          if (this.cell.pos.isFree() && bee.pos != this.cell.pos)
            bee.goTo(this.cell.pos);
          else
            bee.harvest(this.cell.resource);
          if (bee.creep.store[this.cell.resourceType] >= 25)
            bee.state = states.fflush;
        }

        if (bee.state === states.fflush) {
          let target: StructureLink | StructureContainer | undefined;
          if (this.cell.link && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.link;
          else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.container;

          bee.transfer(target, this.cell.resourceType);

          if (!target)
            bee.state = states.chill;
        }

        if (bee.state === states.chill && this.cell.resourceType === RESOURCE_ENERGY) {
          let target = this.cell.container;
          if (target && target.hits < target.hitsMax) {
            if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
              bee.repair(target);
            if (bee.store.getUsedCapacity(RESOURCE_ENERGY) < 24 && target.store.getUsedCapacity(RESOURCE_ENERGY) >= 18)
              bee.withdraw(target, RESOURCE_ENERGY, 18);
          }
        }
      });
  }
}
