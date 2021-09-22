import { setups } from "../../bees/creepsetups"
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

@profile
export class downgradeMaster extends SwarmMaster {
  lastAttacked: number = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  maxSpawns = Infinity;

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username)
      this.order.delete();

    if (this.checkBees(CONTROLLER_ATTACK_BLOCKED_UPGRADE) && Game.time + CREEP_CLAIM_LIFE_TIME > roomInfo.safeModeEndTime) {
      this.wish({
        setup: setups.claimer,
        amount: 1,
        priority: 9,
      });
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);

    _.forEach(this.activeBees, (bee) => {
      if (!bee.pos.isNearTo(this.order.pos))
        bee.goTo(this.order.pos);
      else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
        let room = Game.rooms[this.order.pos.roomName];
        if (room && room.controller && roomInfo.currentOwner) {
          if (!roomInfo.safePlace && !Game.flags["attack_" + room.name])
            roomInfo.enemies[0].object.pos.createFlag("attack_" + room.name, COLOR_RED, COLOR_RED);

          let ans = bee.attackController(room.controller);
          if (ans === OK) {
            this.lastAttacked = Game.time;
            if (Memory.settings.framerate)
              bee.creep.say("💥");
          }
          else if (ans === ERR_TIRED)
            this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE / 2; // not sure what to DO if reboot and it is tired
        }
      }
    });
  }
}
