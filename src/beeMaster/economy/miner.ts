import { resourceCell } from "../../cells/stage1/resourceCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class minerMaster extends Master {
  cell: resourceCell;
  cooldown: number = 0;
  state: "harvesting" | "full" | "break" = "harvesting";

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive, resourceCell.ref);

    this.cell = resourceCell;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);
    if (this.checkBees() && this.cell.perSecondNeeded > 0 && roomInfo.safePlace && this.cell.operational) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.miner.energy,
        amount: 1,
        priority: 2,
      };

      if (this.cell.resourceType != RESOURCE_ENERGY) {
        order.setup = Setups.miner.minerals;
        order.priority = 6;
      } else if (this.cell.pos.roomName != this.hive.roomName)
        order.priority = 5;

      this.wish(order);
    }
  }

  run() {
    if (this.cell.operational)
      _.forEach(this.bees, (bee) => {
        this.state = "harvesting";
        if (this.cell.resource instanceof Source && this.cell.resource.energy == 0)
          this.state = "break";
        else if (this.cell.extractor && (this.cell.extractor.cooldown > 0 || this.cell.perSecondNeeded == 0))
          this.state = "break";

        // any resource
        if (this.state == "harvesting" && bee.creep.store.getFreeCapacity(this.cell.resourceType) > 0)
          bee.harvest(this.cell.resource);


        if (this.state == "harvesting" && bee.creep.store[this.cell.resourceType] >= 25) {
          let target: StructureLink | StructureContainer | undefined;
          if (this.cell.link && this.cell.resourceType == RESOURCE_ENERGY
            && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.link;
          else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
            target = this.cell.container;

          if (target)
            bee.transfer(target, this.cell.resourceType);
          else
            this.state = "full";
        }

        if (this.state != "harvesting" && this.cell.resourceType == RESOURCE_ENERGY
          && this.cell.container && this.cell.container.hits < this.cell.container.hitsMax) {
          if (bee.store[RESOURCE_ENERGY] > 0)
            bee.repair(this.cell.container);
          if (bee.store[RESOURCE_ENERGY] < 24 && this.cell.container.store[RESOURCE_ENERGY] >= 18)
            bee.withdraw(this.cell.container, RESOURCE_ENERGY, 18);
        }
      });
  }
}
