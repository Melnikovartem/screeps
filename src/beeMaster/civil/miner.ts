import { resourceCell } from "../../cells/resourceCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
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

    if (this.checkBees() && this.cell.perSecondNeeded > 0) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.miner.energy,
        amount: 1,
        priority: 2,
      };

      if (this.cell.resourceType != RESOURCE_ENERGY) {
        order.setup = Setups.miner.minerals;
        order.priority = 5;
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {

      // any resource
      if (bee.creep.store.getFreeCapacity(this.cell.resourceType) > 0) {
        let harvest: boolean = false;
        if (this.cell.resource instanceof Source && this.cell.resource.energy > 0)
          harvest = true;
        if (this.cell.extractor && this.cell.extractor.cooldown == 0)
          harvest = true;

        if (harvest)
          bee.harvest(this.cell.resource);
      }

      if (bee.creep.store[this.cell.resourceType] >= 25) {
        let target: StructureLink | StructureContainer | undefined;
        if (this.cell.link && this.cell.resourceType == RESOURCE_ENERGY
          && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.container;

        if (target)
          bee.transfer(target, this.cell.resourceType);
      }
    });
  }
}
