// refills the respawnCell
import { respawnCell } from "../../cells/stage0/respawnCell";

import { Setups, CreepSetup } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class queenMaster extends Master {
  cell: respawnCell;

  constructor(respawnCell: respawnCell) {
    super(respawnCell.hive, respawnCell.ref);

    this.cell = respawnCell;
  }

  update() {
    super.update();

    if (this.checkBees(CREEP_LIFE_TIME)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: new CreepSetup(Setups.manager.name, { ...Setups.manager.bodySetup }),
        amount: 1,
        priority: 0,
      };

      // can refill in 2.5 runs
      order.setup.name = "Bee Queen"; // well if i coppy may as well change the name
      order.setup.bodySetup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 2 / 50 / 2);

      this.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = this.cell.spawns;
    targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    _.forEach(this.bees, (bee) => {
      if (targets.length) {
        let ans;
        if (bee.creep.store[RESOURCE_ENERGY] == 0) {
          let suckerTarget;

          if (!suckerTarget && this.hive.cells.storageCell)
            suckerTarget = this.hive.cells.storageCell.storage;

          if (suckerTarget)
            ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        }

        if (bee.creep.store[RESOURCE_ENERGY] > 0 || ans == OK) {
          let target = bee.pos.findClosest(targets);
          if (target)
            bee.transfer(target, RESOURCE_ENERGY);
        }
      } else if (this.hive.cells.storageCell && bee.creep.store[RESOURCE_ENERGY] > 0
        && this.hive.cells.storageCell.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        bee.transfer(this.hive.cells.storageCell.storage, RESOURCE_ENERGY);
      } else
        bee.goRest(this.cell.pos);
    });
  }
}
