import { Setups } from "../../creepSetups";
import { Master } from "../_Master";
import type { Bee } from "../../bee";
import type { Order } from "../../order";
import type { SpawnOrder } from "../../Hive";

import { states } from "../_Master";
import { findOptimalResource } from "../../utils"
import { profile } from "../../profiler/decorator";

@profile
export class pickupMaster extends Master {
  order: Order;
  maxSpawns: number = 1;
  spawned: number = 0;

  constructor(order: Order) {
    super(order.hive, "Pickup_" + order.ref);

    this.order = order;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.spawned += 1;
  }

  update() {
    super.update();

    if (this.checkBees() && this.spawned < this.maxSpawns) {
      let order: SpawnOrder = {
        setup: Setups.pickup,
        amount: 1,
        priority: 1,
      };

      this.wish(order);
    }

    if (this.beesAmount === 0 && !this.waitingForBees && this.spawned === this.maxSpawns)
      this.order.delete();
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage)
      return;

    let target: Tombstone | Resource | undefined;
    if (this.order.pos.roomName in Game.rooms) {
      target = this.order.pos.findInRange(FIND_TOMBSTONES, 1)[0];
      if (!target)
        target = this.order.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
    }

    _.forEach(this.bees, (bee) => {
      if (bee.store.getFreeCapacity() == 0)
        bee.state = states.work;

      switch (bee.state) {
        case states.chill:
          if (target) {
            if (bee.store.getFreeCapacity() > 0) {
              if (target instanceof Tombstone)
                bee.withdraw(target, findOptimalResource(target.store));
              else
                bee.pickup(target);
            }
          } else if (bee.store.getUsedCapacity() > 0)
            bee.state = states.work;
          else
            bee.goRest(this.order.pos);

        case states.work:
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
      }
    });
  }
}
