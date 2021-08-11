import { Setups } from "../../creepSetups";
import type { SpawnOrder, Hive } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";

// most basic of bitches a horde full of wasps
export class hordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 500;
  spawned: number = 0;

  tryToDowngrade: boolean = false;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);
  }

  update() {
    super.update();

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);
    // also for miners so not roomInfo.safePlace
    let targetsAlive: boolean = !(roomInfo && (roomInfo.targetCreeps.length + roomInfo.targetBuildings.length) == 0);

    if (targetsAlive && this.destroyTime < Game.time + CREEP_LIFE_TIME)
      this.destroyTime = Game.time + CREEP_LIFE_TIME + 10;

    if (this.checkBees() && this.destroyTime > Game.time + CREEP_LIFE_TIME && this.spawned < this.maxSpawns
      && Game.time >= roomInfo.safeModeEndTime - 100) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.knight,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 1,
      };

      if (order.amount == 1 && this.targetBeeCount > 1)
        order.priority = 5; // 5 for not important army

      this.spawned += order.amount;

      this.wish(order);
    }
  }

  run() {
    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    if (this.tryToDowngrade && roomInfo.safePlace && roomInfo.ownedByEnemy && this.order.pos.roomName in Game.rooms) {
      let controller = Game.rooms[this.order.pos.roomName].controller;
      if (controller && !controller.pos.lookFor(LOOK_FLAGS).length)
        controller.pos.createFlag("downgrade_" + this.order.pos.roomName, COLOR_RED, COLOR_PURPLE);
      this.tryToDowngrade = false;
    }

    let enemyTargetingCurrent: { [id: string]: { current: number, max: number } } = {};

    _.forEach((<(Structure | Creep)[]>roomInfo.targetBuildings).concat(roomInfo.targetCreeps), (enemy) => {
      enemyTargetingCurrent[enemy.id] = {
        current: 0,
        max: enemy.pos.getOpenPositions().length,
      }
    });

    _.forEach(this.bees, (bee) => {
      if (roomInfo.safeModeEndTime < Game.time)
        if (bee.creep.room.name != this.order.pos.roomName) {
          bee.goTo(this.order.pos);
        } else {
          let target: Structure | Creep = <Structure>bee.pos.findClosest(_.filter(roomInfo.targetBuildings,
            (structure) => enemyTargetingCurrent[structure.id].current < enemyTargetingCurrent[structure.id].max));

          if (!target)
            target = <Creep>bee.pos.findClosest(_.filter(roomInfo.targetCreeps,
              (creep) => enemyTargetingCurrent[creep.id].current < enemyTargetingCurrent[creep.id].max));

          if (target) {
            bee.attack(target);
            enemyTargetingCurrent[target.id].current += 1;
          } else {
            if (!bee.pos.isNearTo(this.order.pos))
              bee.goTo(this.order.pos);
          }
        }
      else if (bee.creep.room.name != this.hive.roomName) {
        bee.goToRoom(this.hive.roomName);
      }
    });
  }
}
