import { SwarmMaster } from "../_SwarmMaster";

import { prefix, signText, roomStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class ClaimerMaster extends SwarmMaster {
  maxSpawns = Infinity;
  movePriority = <3>3;
  update() {
    super.update();

    if (this.checkBees(false, CREEP_CLAIM_LIFE_TIME)) {
      let setup = setups.claimer.copy();
      if (this.order.pos.getRoomRangeTo(this.hive, true) >= 5)
        setup.fixed = [TOUGH, TOUGH];
      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
      if (roomInfo.roomState >= roomStates.reservedByInvader) {
        setup.patternLimit = 5;
        setup.fixed = [TOUGH, TOUGH];
      }
      this.wish({
        setup: setup,
        priority: 6,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.order.pos.roomName) {
        bee.goTo(this.order.pos, { useFindRoute: true });
      } else {
        let controller = Game.rooms[this.order.pos.roomName].controller;
        if (controller) {
          if (controller.owner || controller.reservation)
            bee.attackController(controller)
          else if (bee.claimController(controller) === OK) {
            bee.pos.createFlag(prefix.boost + bee.pos.roomName, COLOR_PURPLE, COLOR_WHITE);
            bee.creep.signController(controller, signText.my);
            this.order.delete(true);
            Apiary.destroyTime = Game.time; // create new hive
          }
        } else
          this.order.delete();
      }
      this.checkFlee(bee, this.order.pos);
    });
  }
}
