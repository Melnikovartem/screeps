import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";

export class downgradeMaster extends SwarmMaster {
  lastAttacked: number;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    this.lastSpawns.push(Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE);
    this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  }

  update() {
    super.update();

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
    if (!roomInfo.ownedByEnemy)
      this.destroyTime = Game.time;
    if (roomInfo.safeModeEndTime) // wait untill safe mode run out
      this.lastAttacked = Game.time + roomInfo.safeModeEndTime - CONTROLLER_ATTACK_BLOCKED_UPGRADE;

    if (Game.time > this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE && Game.time != this.destroyTime)
      this.destroyTime = Game.time + CONTROLLER_ATTACK_BLOCKED_UPGRADE; // if no need to destroy i will add time


    // 5 for random shit
    if (!this.waitingForBees && Game.time - this.lastSpawns[0] >= CONTROLLER_ATTACK_BLOCKED_UPGRADE
      && this.destroyTime > Game.time + 100) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.claimer,
        amount: 1,
        priority: 5,
      };

      order.setup.bodySetup.patternLimit = 1; //main idea - block upgrading

      this.wish(order);
    }
  }

  run() {
    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    _.forEach(this.bees, (bee) => {
      if (!bee.creep.pos.isNearTo(this.order.pos))
        bee.goTo(this.order.pos)
      else if (Game.time >= this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE) {
        let room = Game.rooms[this.order.pos.roomName];
        if (room && room.controller && roomInfo.ownedByEnemy) {
          if (!Game.flags["attack_" + room.name] && roomInfo.targetCreeps.length + roomInfo.targetBuildings.length)
            roomInfo.targetCreeps[0].pos.createFlag("attack_" + room.name, COLOR_RED, COLOR_RED);

          let ans = bee.attackController(room.controller);
          if (ans == OK)
            this.lastAttacked = Game.time;
          else if (ans == ERR_TIRED)
            this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE / 2; // not sure what to DO if reboot and it is tired
        }
      }
    });
  }
}
