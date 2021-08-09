// refills the respawnCell
import { respawnCell } from "../../cells/respawnCell";

import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import { Bee } from "../../Bee";
import { Master } from "../_Master";

export class queenMaster extends Master {
  queens: Bee[] = [];
  lastSpawned: number;

  cell: respawnCell;

  constructor(respawnCell: respawnCell) {
    super(respawnCell.hive, "master_" + respawnCell.ref);

    this.cell = respawnCell;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
  }

  newBee(bee: Bee): void {
    this.queens.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.queens, (bee) => {
      let ticksToLive: number = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
      if (Game.time - (CREEP_LIFE_TIME - ticksToLive) >= this.lastSpawned)
        this.lastSpawned = Game.time - (CREEP_LIFE_TIME - ticksToLive);
    });
  }

  update() {
    this.queens = this.clearBees(this.queens);

    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.manager,
        amount: 1,
        priority: 0,
      };

      // can refill in 2.5 runs
      order.setup.bodySetup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 2 / 50 / 2.5);

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = this.cell.spawns;
    targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    _.forEach(this.queens, (bee) => {
      if (targets.length) {
        let ans;
        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
          let suckerTarget;

          if (!suckerTarget && this.hive.cells.storageCell)
            suckerTarget = this.hive.cells.storageCell.storage;

          if (suckerTarget)
            ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        }

        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
          let target = bee.creep.pos.findClosest(targets);
          if (target)
            bee.transfer(target, RESOURCE_ENERGY);
        }
      } else if (this.hive.cells.storageCell && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        && this.hive.cells.storageCell.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        bee.transfer(this.hive.cells.storageCell.storage, RESOURCE_ENERGY);
      }
    });
  }
}
