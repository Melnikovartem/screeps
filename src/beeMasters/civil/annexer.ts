import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";

@profile
export class AnnexMaster extends SwarmMaster {
  movePriority = <3>3;
  maxSpawns = Infinity;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, 25);
    let doAnnex = roomInfo.safePlace;

    if (!this.order.memory.extraInfo) {
      this.order.memory.extraInfo = 0;
      let controller = Game.rooms[this.pos.roomName] && Game.rooms[this.pos.roomName].controller;
      if (controller)
        this.order.memory.extraInfo = controller.pos.getTimeForPath(this.hive);
    }

    if (doAnnex && this.hive.bassboost)
      doAnnex = this.pos.getRoomRangeTo(this.hive.bassboost, true) < 5;

    if (doAnnex && this.checkBees(true, CREEP_CLAIM_LIFE_TIME - this.order.memory.extraInfo - 10)) {
      let setup = setups.claimer.copy();

      if (this.pos.roomName in Game.rooms) {
        let controller = Game.rooms[this.pos.roomName].controller;

        // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
        if (controller)
          if (!controller.reservation || controller.reservation.username !== Apiary.username)
            setup.patternLimit = 3;
          else if (controller.reservation.ticksToEnd < 4200)
            setup.patternLimit = 2;
      }

      this.wish({
        setup: setup,
        priority: roomInfo.roomState === roomStates.reservedByEnemy ? 6 : 5, // first we secure our safe locations
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.pos.roomName)
        bee.goTo(this.pos, { ignoreRoads: true });
      else {
        let controller = Game.rooms[this.pos.roomName].controller;
        if (controller) {
          if ((controller.reservation && controller.reservation.username !== Apiary.username)
            || (controller.owner && controller.owner.username !== Apiary.username))
            bee.attackController(controller, { ignoreRoads: true })
          else
            bee.reserveController(controller, { ignoreRoads: true });
        } else
          this.order.delete();
      }
      this.checkFlee(bee);
    });
  }
}
