import { Master } from "../_Master";

import { states } from "../_Master";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { RespawnCell } from "../../cells/base/respawnCell";
import type { SpawnOrder } from "../../Hive";

@profile
export class QueenMaster extends Master {
  cell: RespawnCell;

  constructor(respawnCell: RespawnCell) {
    super(respawnCell.hive, respawnCell.ref);
    this.cell = respawnCell;
  }

  update() {
    super.update();

    if (this.checkBees(CREEP_LIFE_TIME)) {
      let order: SpawnOrder = {
        setup: setups.queen,
        amount: 1,
        priority: 0,
      };

      // can refill in 2 run
      order.setup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 50 / 2);

      this.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = _.map(this.cell.spawns);
    targets = _.filter(targets.concat(_.map(this.cell.extensions)), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case states.refill:
          if (bee.withdraw(storage, RESOURCE_ENERGY) === OK || bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = states.work;
            let target = bee.pos.findClosest(targets)!;
            if (!bee.pos.isNearTo(target))
              bee.goTo(target);
          }
          break;
        case states.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = states.refill;
            if (storage && !bee.pos.isNearTo(storage))
              bee.goTo(storage);
          } else {
            let ans = bee.transfer(bee.pos.findClosest(targets)!, RESOURCE_ENERGY);
            if (ans === OK) {
              let nearByTargets = _.filter(bee.pos.findInRange(FIND_STRUCTURES, 2), (s) =>
                s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
              if (nearByTargets.length > 0 && !_.filter(nearByTargets, (s) => s.pos.getRangeTo(bee.pos) === 1).length)
                bee.goTo(nearByTargets[0]);
            } else if (ans === ERR_NOT_FOUND)
              bee.state = states.fflush;
          }
          break;
        case states.fflush:
          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
            bee.state = states.chill;
          else if (bee.transfer(storage, RESOURCE_ENERGY) !== OK)
            break;
        case states.chill:
          if (targets.length)
            bee.state = states.work;
          else
            bee.goRest(this.cell.pos);
          break;
        case states.boosting:
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "capacity" }]) === OK)
            bee.state = states.chill;
          break;
      }
    });
  }
}
