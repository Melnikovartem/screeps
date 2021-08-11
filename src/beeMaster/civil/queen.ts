// refills the respawnCell
import { respawnCell } from "../../cells/respawnCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class queenMaster extends Master {
  cell: respawnCell;

  constructor(respawnCell: respawnCell) {
    super(respawnCell.hive, "master_" + respawnCell.ref);

    this.cell = respawnCell;

    this.lastSpawns.push(Game.time - CREEP_LIFE_TIME);
  }

  update() {
    super.update();

    // 5 for random shit
    if (!this.waitingForBees && Game.time + 5 >= this.lastSpawns[0] + CREEP_LIFE_TIME) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.manager,
        amount: 1,
        priority: 0,
      };

      // can refill in 2.5 runs
      order.setup.bodySetup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 2 / 50 / 2.5);

      this.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = this.cell.spawns;
    targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    _.forEach(this.bees, (bee) => {
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
