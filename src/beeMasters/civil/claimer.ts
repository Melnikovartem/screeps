import { SwarmMaster } from "../_SwarmMaster";

import { prefix, signText } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class ClaimerMaster extends SwarmMaster {
  update() {
    super.update();

    if (this.checkBees(false, CREEP_CLAIM_LIFE_TIME)) {
      this.wish({
        setup: setups.claimer,
        priority: 6,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = <StructureController>_.filter(this.order.pos.lookFor(LOOK_STRUCTURES), s => s.structureType === STRUCTURE_CONTROLLER)[0];
        if (controller && !controller.owner) {
          if (bee.claimController(controller) === OK) {
            bee.pos.createFlag(prefix.boost + bee.pos.roomName, COLOR_PURPLE, COLOR_WHITE);
            bee.creep.signController(controller, signText.my);
          }
          Apiary.destroyTime = Game.time; // create new hive
        } else
          this.order.delete();
      }
    });
  }
}
