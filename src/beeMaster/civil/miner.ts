import { resourceCell } from "../../cells/resourceCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class minerMaster extends Master {

  cell: resourceCell;

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive, "master_" + resourceCell.ref);

    this.cell = resourceCell;

    this.lastSpawns.push(Game.time - CREEP_LIFE_TIME);
  }

  update() {
    super.update();

    // 5 for random shit
    if (!this.waitingForBees && Game.time + 5 >= this.lastSpawns[0] + CREEP_LIFE_TIME && (this.cell.link || this.cell.container)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.miner.energy,
        amount: 1,
        priority: 2,
      };

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        bee.harvest(this.cell.source);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 25) {
        let target: Structure | undefined;
        if (this.cell.link && this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.cell.container;

        if (target)
          bee.transfer(target, RESOURCE_ENERGY);
      }
    });
  }
}
