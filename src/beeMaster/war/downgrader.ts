import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import type { Hive } from "../../Hive";
import type { Bee } from "../../Bee";
import { SwarmMaster } from "../_SwarmMaster";

export class downgradeMaster extends SwarmMaster {
  claimers: Bee[] = [];
  lastSpawned: number;

  lastAttacked: number;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    this.lastSpawned = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
    this.lastAttacked = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;
  }

  newBee(bee: Bee): void {
    this.claimers.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.claimers, (bee) => {
      let ticksToLive: number = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
      if (Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive) >= this.lastSpawned)
        this.lastSpawned = Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive);
    });
  }

  update() {
    this.claimers = this.clearBees(this.claimers);

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
    if (!roomInfo.ownedByEnemy)
      this.destroyTime = Game.time;
    if (roomInfo.safeModeEndTime) // wait untill safe mode run out
      this.lastAttacked = Game.time + roomInfo.safeModeEndTime - CONTROLLER_ATTACK_BLOCKED_UPGRADE;

    if (Game.time > this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE && Game.time != this.destroyTime)
      this.destroyTime = Game.time + CONTROLLER_ATTACK_BLOCKED_UPGRADE; // if no need to destroy i will add time


    // 5 for random shit
    if (Game.time - this.lastSpawned >= CONTROLLER_ATTACK_BLOCKED_UPGRADE && this.destroyTime > Game.time + 100) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.claimer,
        amount: 1,
        priority: 5,
      };

      order.setup.bodySetup.patternLimit = 1; //main idea - block upgrading

      this.hive.wish(order);
      this.lastSpawned = Game.time;
    }
  }

  run() {
    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    _.forEach(this.claimers, (bee) => {
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
