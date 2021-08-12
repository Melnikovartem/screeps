import { resourceCell } from "../../cells/resourceCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class minerMaster extends Master {

  cell: resourceCell;

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive, "master_" + resourceCell.ref);

    this.cell = resourceCell;
  }

  update() {
    super.update();

    // 5 for random shit
    if (this.checkBees() && (this.cell.container || this.cell.link)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.miner.energy,
        amount: 1,
        priority: 2,
      };

      order.setup.bodySetup.patternLimit = Math.ceil(this.cell.perSecond / 2 / 2);

      this.print(this.cell.perSecond);

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      // any resource
      if (bee.creep.store.getFreeCapacity() > 0) {
        if (this.cell.resource instanceof Source && this.cell.resource.energy > 0)
          bee.harvest(this.cell.resource);
        if (this.cell.extractor && this.cell.extractor.cooldown == 0)
          bee.harvest(this.cell.resource);
      }

      if (bee.creep.store.getUsedCapacity() >= 25) {
        let target: StructureLink | StructureContainer | undefined;
        if (this.cell.link && this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY) && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity())
          target = this.cell.container;

        if (target)
          bee.transfer(target, <ResourceConstant>Object.keys(bee.store)[0]);
      }
    });
  }
}
