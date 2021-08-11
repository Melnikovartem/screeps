import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import type { Hive } from "../../Hive";
import type { Bee } from "../../Bee";
import { SwarmMaster } from "../_SwarmMaster";

// most basic of bitches a horde full of wasps
export class hordeMaster extends SwarmMaster {
  knights: Bee[] = [];

  targetBeeCount: number;
  waitingForABee: number = 0;

  // failsafe
  maxSpawns: number = 500;
  spawned: number = 0;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    this.targetBeeCount = 2;
  }

  newBee(bee: Bee): void {
    this.knights.push(bee);
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.knights = this.clearBees(this.knights);

    let targetsAlive: boolean = true;

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    if (roomInfo && (roomInfo.targetCreeps.length + roomInfo.targetBuildings.length) == 0)
      targetsAlive = false;

    if (targetsAlive && this.destroyTime < Game.time + 500)
      this.destroyTime = Game.time + 1000;

    if (this.knights.length < this.targetBeeCount && !this.waitingForABee && targetsAlive && this.spawned < this.maxSpawns) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.knight,
        amount: this.targetBeeCount - this.knights.length,
        priority: 1, // 5 for not important army
      };

      if (this.targetBeeCount - this.knights.length == 1 && this.targetBeeCount > 1)
        order.priority = 5;

      this.waitingForABee += this.targetBeeCount - this.knights.length;
      this.spawned += this.targetBeeCount - this.knights.length;

      this.hive.wish(order);
    }
  }

  run() {
    // it is cached after first check

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    let enemyTargetingCurrent: { [id: string]: { current: number, max: number } } = {};


    _.forEach((<(Structure | Creep)[]>roomInfo.targetBuildings).concat(roomInfo.targetCreeps), (enemy) => {
      enemyTargetingCurrent[enemy.id] = {
        current: 0,
        max: enemy.pos.getOpenPositions().length,
      }
    });

    _.forEach(this.knights, (bee) => {
      if (bee.creep.room.name != this.order.pos.roomName) {
        bee.goTo(this.order.pos);
      } else {
        let target: Structure | Creep = <Structure>bee.creep.pos.findClosest(_.filter(roomInfo.targetBuildings,
          (structure) => enemyTargetingCurrent[structure.id].current < enemyTargetingCurrent[structure.id].max));

        if (!target)
          target = <Creep>bee.creep.pos.findClosest(_.filter(roomInfo.targetCreeps,
            (creep) => enemyTargetingCurrent[creep.id].current < enemyTargetingCurrent[creep.id].max));

        if (target) {
          bee.attack(target);
          enemyTargetingCurrent[target.id].current += 1;
        } else {
          if (!bee.creep.pos.isNearTo(this.order.pos))
            bee.goTo(this.order.pos);
        }
      }
    });
  }
}
