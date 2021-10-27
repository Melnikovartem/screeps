import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class DowngradeMaster extends SwarmMaster {
  lastAttacked: number = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  maxSpawns = Infinity;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, Infinity);
    if (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username) {
      this.order.delete();
      return;
    }
    let room = Game.rooms[this.order.pos.roomName];
    if (room && room.controller && room.controller.upgradeBlocked)
      this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE + room.controller.upgradeBlocked;
    if (this.checkBees(false, CONTROLLER_ATTACK_BLOCKED_UPGRADE) && Game.time + CREEP_CLAIM_LIFE_TIME > roomInfo.safeModeEndTime) {
      this.wish({
        setup: setups.claimer,
        priority: 9,
      });
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);

    _.forEach(this.activeBees, bee => {
      if (!bee.pos.isNearTo(this.order.pos))
        bee.goTo(this.order.pos);
      else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
        let room = Game.rooms[this.order.pos.roomName];
        if (room && room.controller && roomInfo.currentOwner) {
          let ans = bee.attackController(room.controller);
          if (ans === OK && Memory.settings.framerate)
            bee.creep.say("💥");
        }
      }
      this.checkFlee(bee);
    });
  }
}
