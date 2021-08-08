import { resourceCell } from "../cells/resourceCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class minerMaster extends Master {
  miners: Bee[] = [];
  lastSpawned: number;

  cell: resourceCell;

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive, "master_" + resourceCell.ref);

    this.cell = resourceCell;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    this.refreshLastSpawned();
  }

  newBee(bee: Bee): void {
    this.miners.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.miners, (bee) => {
      if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
        this.lastSpawned = Game.time - bee.creep.ticksToLive;
    });
  }

  update() {
    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME && (this.cell.link || this.cell.container)) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.miner.energy,
        amount: 1,
      };

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.miners, (bee) => {
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
  };
}
