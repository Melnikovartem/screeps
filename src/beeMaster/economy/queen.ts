// refills the respawnCell
import { respawnCell } from "../../cells/base/respawnCell";

import { Setups, CreepSetup } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master, states } from "../_Master";
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
        setup: new CreepSetup(Setups.queen.name, { ...Setups.queen.bodySetup }),
        amount: 1,
        priority: 0,
      };

      // can refill in 2.5 runs
      order.setup.bodySetup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 2 / 50 / 2);

      this.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = this.cell.spawns;
    targets = _.filter(targets.concat(this.cell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    _.forEach(this.bees, (bee) => {
      if (bee.creep.store[RESOURCE_ENERGY] == 0) {
        if (targets.length)
          bee.state = states.refill;
        else
          bee.state = states.chill;
      } else {
        if (targets.length)
          bee.state = states.work;
        else
          bee.state = states.fflush;
      }

      if (bee.state == states.refill && bee.withdraw(this.hive.cells.storage && this.hive.cells.storage.storage, RESOURCE_ENERGY) == OK)
        bee.state = states.work;

      if (bee.state == states.work && targets.length)
        bee.transfer(bee.pos.findClosest(targets)!, RESOURCE_ENERGY);

      if (bee.state == states.fflush)
        bee.transfer(this.hive.cells.storage && this.hive.cells.storage.storage, RESOURCE_ENERGY);

      if (bee.state == states.chill)
        bee.goRest(this.cell.pos);
    });
  }
}
