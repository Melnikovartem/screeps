import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { Master } from "../_Master";

import { profile } from "../../profiler/decorator";

@profile
export class claimerMaster extends Master {
  order: Order;
  maxSpawns: number = 1;
  spawned: number = 0;

  constructor(order: Order) {
    super(order.hive, "Claimer_" + order.ref);

    this.order = order;
  }

  update() {
    super.update();

    if (this.beesAmount == 0 && !this.waitingForBees && this.spawned == this.maxSpawns)
      this.order.destroyTime = Game.time;

    if (this.checkBees(CREEP_CLAIM_LIFE_TIME)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 6,
      };

      this.wish(order);
      this.spawned += 1;
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.pos.roomName != this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_CONTROLLER)[0];
        if (controller && !controller.owner)
          bee.claimController(controller);
        else
          this.order.destroyTime = 0;
      }
    });
  }
}