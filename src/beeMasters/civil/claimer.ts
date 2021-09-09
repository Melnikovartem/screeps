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

    if (this.beesAmount === 0 && !this.waitingForBees && this.spawned === this.maxSpawns)
      this.order.delete();

    if (this.checkBees(CREEP_CLAIM_LIFE_TIME)) {
      let order: SpawnOrder = {
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
      if (bee.pos.roomName !== this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType === STRUCTURE_CONTROLLER)[0];
        if (controller && !controller.owner) {
          if (bee.claimController(controller) === OK)
            bee.pos.createFlag("boost_" + bee.pos.roomName, COLOR_PURPLE, COLOR_WHITE);
          Apiary.destroyTime = Game.time; // create new hive
        } else
          this.order.delete();
      }
    });
  }
}
