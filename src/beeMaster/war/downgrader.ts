import { Setups } from "../../creepSetups"
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

@profile
export class downgradeMaster extends SwarmMaster {
  lastAttacked: number;

  constructor(order: Order) {
    super(order.hive, order);

    this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (!roomInfo.ownedByEnemy)
      this.order.destroyTime = Game.time;
    else if (Game.time + CONTROLLER_ATTACK_BLOCKED_UPGRADE >= this.order.destroyTime)
      this.order.destroyTime = Game.time + CONTROLLER_ATTACK_BLOCKED_UPGRADE;
    if (roomInfo.safeModeEndTime)
      this.lastAttacked = roomInfo.safeModeEndTime - CONTROLLER_ATTACK_BLOCKED_UPGRADE;

    if (this.checkBees(CONTROLLER_ATTACK_BLOCKED_UPGRADE) && this.order.destroyTime > Game.time + 100
      && Game.time + CREEP_CLAIM_LIFE_TIME >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer.normal,
        amount: 1,
        priority: 9,
      };

      this.wish(order);
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);

    _.forEach(this.bees, (bee) => {
      if (!bee.pos.isNearTo(this.order.pos))
        bee.goTo(this.order.pos);
      else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
        let room = Game.rooms[this.order.pos.roomName];
        if (room && room.controller && roomInfo.ownedByEnemy) {
          if (!roomInfo.safePlace && !Game.flags["attack_" + room.name])
            roomInfo.enemies[0].pos.createFlag("attack_" + room.name, COLOR_RED, COLOR_RED);

          let ans = bee.attackController(room.controller);
          if (ans == OK) {
            this.lastAttacked = Game.time;
            if (Memory.settings.visuals)
              bee.creep.say("💥");
          }
          else if (ans == ERR_TIRED)
            this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE / 2; // not sure what to DO if reboot and it is tired
        }
      }
    });
  }
}
