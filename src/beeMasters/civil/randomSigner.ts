import { SwarmMaster } from "../_SwarmMaster";

import { signText } from "../../enums";
import { setups } from "../../bees/creepSetups";

import { profile } from "../../profiler/decorator";

@profile
export class SignerMaster extends SwarmMaster {
  maxSpawns = 1;
  movePriority = 3 as const;

  update() {
    super.update();

    if (this.checkBees(false, CREEP_CLAIM_LIFE_TIME)) {
      const setup = setups.claimer.copy();
      setup.fixed = [TOUGH, TOUGH, HEAL, HEAL];
      this.wish({
        setup,
        priority: 8,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      if (!bee.target) {
        const rooms = Memory.cache.roomsToSign;
        if (!rooms.length) {
          return;
        }
        bee.target = rooms.reduce((prev, curr) =>
          bee.pos.getRoomRangeTo(curr) < bee.pos.getRoomRangeTo(prev)
            ? curr
            : prev
        );
      }
      if (bee.pos.roomName !== bee.target) {
        bee.goTo(new RoomPosition(25, 25, bee.target), {
          useFindRoute: true,
          ignoreRoads: true,
        });
      } else {
        const controller = Game.rooms[this.pos.roomName].controller;
        if (controller) {
          bee.creep.signController(controller, signText.my);
          bee.target = undefined;
          const index = Memory.cache.roomsToSign.indexOf(bee.pos.roomName);
          if (index !== -1) Memory.cache.roomsToSign.splice(index, 1);
        } else bee.target = undefined;
      }
      if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL)) bee.heal(bee);
      this.checkFlee(
        bee,
        undefined,
        { useFindRoute: true, ignoreRoads: true },
        false
      );
    });
  }
}
