import { setups } from "bees/creepSetups";
import { hiveStates, roomStates, signText } from "enums";
import type { FlagOrder } from "order";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class ClaimerMaster extends SwarmMaster {
  public movePriority = 3 as const;

  public constructor(order: FlagOrder) {
    super(order);
    this.maxSpawns = 5;
  }

  public update() {
    super.update();

    if (
      this.checkBees(
        this.hive.state !== hiveStates.battle,
        CREEP_CLAIM_LIFE_TIME
      )
    ) {
      const setup = setups.claimer.copy();
      if (this.pos.getRoomRangeTo(this.hive, "path") >= 4)
        setup.fixed = [TOUGH, TOUGH, HEAL, HEAL];
      const roomInfo = Apiary.intel.getInfo(this.pos.roomName, 20);
      if (roomInfo.roomState >= roomStates.reservedByInvader)
        setup.patternLimit = 5;
      this.wish({
        setup,
        priority: 2,
      });
    }
  }

  public run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.pos.roomName !== this.pos.roomName) {
        bee.goTo(this.pos, { useFindRoute: true, ignoreRoads: true });
      } else {
        const controller = Game.rooms[this.pos.roomName].controller;
        if (controller) {
          if (!bee.pos.isNearTo(controller))
            bee.goTo(controller, { ignoreRoads: true });
          else if (
            (controller.owner &&
              controller.owner.username !== Apiary.username) ||
            (controller.reservation &&
              controller.reservation.username !== Apiary.username)
          )
            bee.attackController(controller);
          else {
            if (!controller.owner)
              if (bee.claimController(controller) !== OK) return;
              else Apiary.destroyTime = Game.time; // create new hive
            bee.creep.signController(controller, signText.my);
            this.order.delete();
          }
        } else this.order.delete();
        if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
          bee.heal(bee);
      }
      this.checkFlee(bee, undefined, { useFindRoute: true }, false);
    });
  }
}
