import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { RespawnCell } from "../../cells/base/respawnCell";

@profile
export class QueenMaster extends Master {
  cell: RespawnCell;
  movePriority = <3>3;

  constructor(respawnCell: RespawnCell) {
    super(respawnCell.hive, respawnCell.ref);
    this.cell = respawnCell;
  }

  update() {
    super.update();

    if (this.checkBees(false)) {
      let order = {
        setup: setups.queen,
        amount: 1,
        priority: <0>0,
      };

      // can refill in 2 run
      order.setup.patternLimit = Math.ceil(this.hive.room.energyCapacityAvailable / 50 / 2);

      this.wish(order);
    }
  }

  run() {
    let targets: (StructureSpawn | StructureExtension)[] = _.map(this.cell.spawns);
    targets = _.filter(targets.concat(_.map(this.cell.extensions)), structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.refill:
          if (bee.withdraw(storage, RESOURCE_ENERGY) === OK || bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.work;
            let target = bee.pos.findClosest(targets)!;
            if (!bee.pos.isNearTo(target))
              bee.goTo(target);
          }
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.refill;
            if (storage && !bee.pos.isNearTo(storage))
              bee.goTo(storage);
          } else {
            let ans = bee.transfer(bee.pos.findClosest(targets)!, RESOURCE_ENERGY);
            if (ans === OK) {
              let nearByTargets = _.filter(bee.pos.findInRange(FIND_STRUCTURES, 2), s =>
                s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
              if (nearByTargets.length > 0 && !_.filter(nearByTargets, s => s.pos.getRangeTo(bee.pos) === 1).length)
                bee.goTo(nearByTargets[0]);
            } else if (ans === ERR_NOT_FOUND)
              bee.state = beeStates.fflush;
          }
          break;
        case beeStates.fflush:
          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
            bee.state = beeStates.chill;
          else if (bee.transfer(storage, RESOURCE_ENERGY) !== OK)
            break;
        case beeStates.chill:
          if (targets.length)
            bee.state = beeStates.work;
          else
            bee.goRest(this.cell.pos);
          break;
        case beeStates.boosting:
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "capacity" }]) === OK)
            bee.state = beeStates.chill;
          break;
      }
    });
  }
}
