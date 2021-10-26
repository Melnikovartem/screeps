import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class AnnexMaster extends SwarmMaster {
  movePriority = <3>3;
  maxSpawns = Infinity;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);
    let doAnnex = roomInfo.safePlace;

    if (doAnnex && this.hive.bassboost)
      doAnnex = this.order.pos.getRoomRangeTo(this.hive.bassboost, true) < 5;

    if (doAnnex && this.checkBees(false, CREEP_CLAIM_LIFE_TIME)) {
      let order = {
        setup: setups.claimer,
        priority: <6>6,
      };

      if (this.order.pos.roomName in Game.rooms) {
        let controller = Game.rooms[this.order.pos.roomName].controller;

        // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
        if (controller && (!controller.reservation || controller.reservation.username !== Apiary.username || controller.reservation.ticksToEnd < 4200)) {
          order.setup = order.setup.copy();
          order.setup.patternLimit = 2;
        }
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.order.pos.roomName)
        bee.goTo(this.order.pos);
      else {
        let controller = Game.rooms[this.order.pos.roomName].controller;
        if (controller) {
          if ((controller.reservation && controller.reservation.username !== Apiary.username)
            || (controller.owner && controller.owner.username !== Apiary.username))
            bee.attackController(controller)
          else
            bee.reserveController(controller);
        } else
          this.order.delete();
      }
      this.checkFlee(bee, this.hive);
    });
  }
}
