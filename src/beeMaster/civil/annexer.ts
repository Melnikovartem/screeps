import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";

import { UPDATE_EACH_TICK } from "../../settings";

export class annexMaster extends Master {
  controller: StructureController; //controllers rly don't age...

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "master_" + "annexerRoom_" + controller.room.name);

    this.controller = controller;
    this.lastSpawns.push(Game.time - CREEP_CLAIM_LIFE_TIME);
  }

  update() {
    super.update();

    if (UPDATE_EACH_TICK) {
      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;
    }

    // 5 for random shit
    if (!this.waitingForBees && Game.time + 5 >= this.lastSpawns[0] + CREEP_CLAIM_LIFE_TIME) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer,
        amount: 1,
        priority: 2,
      };

      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;

      // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
      if (this.controller && this.controller.reservation && this.controller.reservation.ticksToEnd >= 4200)
        order.setup.bodySetup.patternLimit = 1; //make smaller if not needed

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      bee.reserveController(this.controller);
    });
  }
}
