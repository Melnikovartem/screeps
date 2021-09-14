import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { SpawnOrder } from "../../Hive";

import { profile } from "../../profiler/decorator";

@profile
export class annexMaster extends SwarmMaster {
  maxSpawns = Infinity;
  operational = true;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 10);
    if (this.checkBees(CREEP_CLAIM_LIFE_TIME) && roomInfo.safePlace && !roomInfo.ownedByEnemy && this.operational) {
      let order: SpawnOrder = {
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 6,
      };

      if (this.order.pos.roomName in Game.rooms) {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType === STRUCTURE_CONTROLLER)[0];

        // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
        if (controller && (!controller.reservation || controller.reservation.ticksToEnd < 4200))
          order.setup = Setups.claimer.double;
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.pos.roomName !== this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType === STRUCTURE_CONTROLLER)[0];
        if (controller)
          bee.reserveController(controller);
        else
          this.order.delete();
      }
    });
  }
}
