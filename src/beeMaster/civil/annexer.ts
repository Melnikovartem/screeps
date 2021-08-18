import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { Master } from "../_Master";

import { profile } from "../../profiler/decorator";

@profile
export class annexMaster extends Master {
  order: Order;

  constructor(order: Order) {
    super(order.hive, "Annexer_" + order.ref);

    this.order = order;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 10);
    if (this.checkBees(CREEP_CLAIM_LIFE_TIME) && roomInfo.safePlace && !roomInfo.ownedByEnemy) {
      let order: SpawnOrder = {
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 5,
      };

      if (this.order.pos.roomName in Game.rooms) {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_CONTROLLER)[0];

        // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
        if (controller && (!controller.reservation || controller.reservation.ticksToEnd < 4200))
          order.setup = Setups.claimer.double;
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.pos.roomName != this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_CONTROLLER)[0];
        if (controller)
          bee.reserveController(controller);
        else
          this.order.destroyTime = 0;
      }
    });
  }
}
