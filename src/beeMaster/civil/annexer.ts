import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";

import { UPDATE_EACH_TICK } from "../../settings";

export class annexMaster extends Master {
  controller: StructureController; //controllers rly don't age...

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "master_annexerRoom_" + controller.room.name);

    this.controller = controller;
  }

  update() {
    super.update();

    if (UPDATE_EACH_TICK) {
      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;
    }

    if (this.checkBees(CREEP_CLAIM_LIFE_TIME)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 3,
      };

      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;

      // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
      if (this.controller && this.controller.reservation && this.controller.reservation.ticksToEnd < 4200) {
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
