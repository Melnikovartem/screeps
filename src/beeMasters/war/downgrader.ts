import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { signText } from "../../enums";

import { profile } from "../../profiler/decorator";

@profile
export class DowngradeMaster extends SwarmMaster {
  lastAttacked: number = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  maxSpawns = 100; // around 1M in creeps

  get oldestSpawn() {
    return this.order.memory.extraInfo;
  }

  set oldestSpawn(value) {
    if (this.order)
      this.order.memory.extraInfo = value;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    if (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username) {
      this.order.delete();
      return;
    }

    let room = Game.rooms[this.pos.roomName];
    if (room && room.controller) {
      this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE + (room.controller.upgradeBlocked || 0);
      if (!room.controller.owner) {
        this.order.delete();
        return;
      }
      if (Game.time % 25 === 0)
        this.hive.cells.defense.checkAndDefend(this.pos.roomName);
    }

    if (this.checkBees(false, CONTROLLER_ATTACK_BLOCKED_UPGRADE - 50) && this.hive.resState[RESOURCE_ENERGY] > 0 && Game.time + CREEP_CLAIM_LIFE_TIME > roomInfo.safeModeEndTime && !roomInfo.towers.length)
      this.wish({
        setup: setups.downgrader,
        priority: 9,
      });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE > Game.time + bee.ticksToLive && bee.pos.roomName === this.pos.roomName) {
        let room = Game.rooms[bee.pos.roomName];
        let cc = bee.pos.findClosest(room.find(FIND_HOSTILE_CONSTRUCTION_SITES).filter(c => c.progress));
        if (cc)
          bee.goTo(cc);
      } else if (!bee.pos.isNearTo(this.pos))
        bee.goTo(this.pos);
      else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
        let room = Game.rooms[this.pos.roomName];
        if (room && room.controller) {
          let ans = bee.attackController(room.controller);
          if (ans === OK) {
            bee.creep.signController(room.controller, signText.other);
            bee.creep.say("????");
          }
        }
      }
      this.checkFlee(bee, { pos: this.pos }, undefined, false);
    });
  }
}
