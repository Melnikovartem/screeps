import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";

import { UPDATE_EACH_TICK } from "../../settings";
import { profile } from "../../profiler/decorator";

@profile
export class annexMaster extends Master {
  controller: StructureController; //controllers rly don't age...

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "Annexer_" + controller.room.name);

    this.controller = controller;
  }

  update() {
    super.update();

    if (UPDATE_EACH_TICK || Game.time % 50 == 29) {
      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;
    }

    let roomInfo = Apiary.intel.getInfo(this.controller.pos.roomName, 10);
    if (this.checkBees(CREEP_CLAIM_LIFE_TIME) && roomInfo.safePlace && !roomInfo.ownedByEnemy) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 6,
      };

      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;

      // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
      if (this.controller && (!this.controller.reservation || this.controller.reservation.ticksToEnd < 4200)) {
        order.setup = Setups.claimer.double
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      bee.reserveController(this.controller);
    });
  }
}
