// refills the respawnCell
import { respawnCell } from "../cells/respawnCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class queenMaster extends Master {
  queens: Bee[] = [];
  lastSpawned: number;

  cell: respawnCell;

  constructor(respawnCell: respawnCell) {
    super(respawnCell.hive, "master_" + respawnCell.ref);

    this.cell = respawnCell;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    this.refreshLastSpawned();
  }

  newBee(bee: Bee): void {
    this.queens.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.queens, (bee) => {
      if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
        this.lastSpawned = Game.time - bee.creep.ticksToLive;
    });
  }

  update() {
    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.manager.normal,
        amount: 1,
      };

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  };

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = this.cell.spawns;
    targets = targets.concat(this.cell.extensions);

    _.forEach(this.queens, (bee) => {
      let target = _.filter(targets, (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && target) {
        bee.transfer(target, RESOURCE_ENERGY);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 || !target) {
        let suckerTarget;

        if (!suckerTarget && this.hive.cells.storageCell)
          suckerTarget = this.hive.cells.storageCell.storage;

        if (suckerTarget)
          bee.withdraw(suckerTarget, RESOURCE_ENERGY);
      }
    });
  };
}
