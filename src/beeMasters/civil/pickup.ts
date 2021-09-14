import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { SpawnOrder } from "../../Hive";

import { states } from "../_Master";
import { findOptimalResource } from "../../abstract/utils"
import { profile } from "../../profiler/decorator";

@profile
export class pickupMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: Setups.pickup,
        amount: 1,
        priority: 4,
      };

      this.wish(order);
    }
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage)
      return;

    let target: Tombstone | Ruin | Resource | StructureStorage | undefined;
    if (this.order.pos.roomName in Game.rooms) {
      target = this.order.pos.lookFor(LOOK_RUINS)[0];
      if (!target)
        target = this.order.pos.lookFor(LOOK_TOMBSTONES)[0];
      if (!target)
        target = this.order.pos.lookFor(LOOK_RESOURCES)[0];
      if (!target)
        target = <StructureStorage>this.order.pos.lookFor(LOOK_STRUCTURES)
          .filter((s) => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0)[0];
    }

    _.forEach(this.bees, (bee) => {
      if (bee.store.getFreeCapacity() === 0)
        bee.state = states.fflush;
      else if (bee.store.getUsedCapacity() === 0)
        bee.state = states.refill;

      switch (bee.state) {
        case states.chill:
          bee.state = states.refill;
        case states.refill:
          if (target) {
            if (bee.store.getFreeCapacity() > 0)
              if (target instanceof Resource)
                bee.pickup(target);
              else
                bee.withdraw(target, findOptimalResource(target.store));
          } else if (bee.store.getUsedCapacity() > 0)
            bee.state = states.fflush;
          else
            bee.goRest(this.order.pos);
          break;
        case states.fflush:
          if (!bee.target)
            bee.target = findOptimalResource(bee.store);
          if (bee.target) {
            let res = <ResourceConstant>bee.target;
            let ans = bee.transfer(storage, res);
            if (ans === OK) {
              bee.target = null;
              if (Apiary.logger)
                Apiary.logger.resourceTransfer(this.hive.roomName, "pickup", bee.store, storage!.store, res, 1);
            }
          } else
            bee.state = states.chill;
          break;
      }

      // if (!target && bee.pos.roomName === this.order.pos.roomName && (this.order.pos.x !== this.hive.pos.x || this.order.pos.y !== this.hive.pos.y))
      // this.order.flag.setPosition(this.hive.pos);
    });
  }
}
