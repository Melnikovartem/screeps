import { setups } from "../../bees/creepsetups";
import { SwarmMaster } from "../_SwarmMaster";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder } from "../../Hive";

@profile
export class claimerMaster extends SwarmMaster {
  update() {
    super.update();

    if (this.checkBees(CREEP_CLAIM_LIFE_TIME)) {
      let order: SpawnOrder = {
        setup: setups.claimer,
        amount: 1,
        priority: 6,
      };

      this.wish(order);
      this.spawned += 1;
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
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
