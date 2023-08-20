import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepSetups";

import { profile } from "../../profiler/decorator";

@profile
export class AnnexMaster extends SwarmMaster {
  movePriority = 3 as const;
  maxSpawns = Infinity;

  get reservationTime() {
    return (this.order.memory.extraInfo as number) || 0;
  }

  set reservationTime(value: number) {
    this.order.memory.extraInfo = value;
  }

  update() {
    super.update();

    if (this.pos.roomName in Game.rooms) {
      const controller = Game.rooms[this.pos.roomName].controller;
      if (
        controller &&
        controller.reservation &&
        controller.reservation.username === Apiary.username
      )
        this.reservationTime = controller.reservation.ticksToEnd;
    } else this.reservationTime -= 1;

    if (this.reservationTime > 2000) return;

    let doAnnex = !this.hive.annexInDanger.includes(this.pos.roomName);

    if (doAnnex && this.hive.bassboost)
      doAnnex = this.pos.getRoomRangeTo(this.hive.bassboost, "path") < 5;

    if (doAnnex && this.checkBees(true, CREEP_CLAIM_LIFE_TIME - 10)) {
      const setup = setups.claimer.copy();
      setup.patternLimit =
        Math.floor((CONTROLLER_RESERVE_MAX - this.reservationTime) / 600) + 1;
      this.wish({
        setup,
        priority: 6, // first we secure our safe locations
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.pos.roomName !== this.pos.roomName)
        bee.goTo(this.pos, { ignoreRoads: true });
      else {
        const controller = Game.rooms[this.pos.roomName].controller;
        if (controller) {
          if (
            (controller.reservation &&
              controller.reservation.username !== Apiary.username) ||
            (controller.owner && controller.owner.username !== Apiary.username)
          )
            bee.attackController(controller, { ignoreRoads: true });
          else bee.reserveController(controller, { ignoreRoads: true });
        } else this.order.delete();
      }
      this.checkFlee(bee, this.hive);
    });
  }
}
