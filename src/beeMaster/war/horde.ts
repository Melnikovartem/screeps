import { Setups } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class hordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 100;
  spawned: number = 0;

  tryToDowngrade: boolean = false;
  priority: 1 | 4 = 1; // how fast do we need to put out the enemy

  constructor(order: Order) {
    super(order.hive, order);
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);

    if (!roomInfo.safePlace && this.order.destroyTime <= Game.time + CREEP_LIFE_TIME)
      this.order.destroyTime = Game.time + CREEP_LIFE_TIME + 10;

    if (this.spawned == this.maxSpawns && !this.beesAmount && !this.waitingForBees)
      this.order.destroyTime = Game.time;

    if (this.checkBees() && this.spawned < this.maxSpawns
      && (Game.time >= roomInfo.safeModeEndTime - 100) && this.order.destroyTime > Game.time + CREEP_LIFE_TIME) {
      let order: SpawnOrder = {
        setup: Setups.knight,
        amount: this.targetBeeCount - this.beesAmount,
        priority: this.priority,
      };

      if (this.priority == 1)
        order.setup = Setups.defender;

      this.spawned += order.amount;

      this.wish(order);
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);

    if (this.tryToDowngrade && roomInfo.safePlace && roomInfo.ownedByEnemy && this.order.pos.roomName in Game.rooms) {
      let controller = Game.rooms[this.order.pos.roomName].controller;
      if (controller && !controller.pos.lookFor(LOOK_FLAGS).length)
        controller.pos.createFlag("downgrade_" + this.order.pos.roomName, COLOR_RED, COLOR_PURPLE);
      this.tryToDowngrade = false;
    }

    let enemyTargetingCurrent: { [id: string]: { current: number, max: number } } = {};

    _.forEach(roomInfo.enemies, (enemy) => {
      enemyTargetingCurrent[enemy.id] = {
        current: 0,
        max: enemy.pos.getOpenPositions(true).length,
      }
    });

    _.forEach(this.bees, (bee) => {
      if (roomInfo.safeModeEndTime < Game.time || !roomInfo.ownedByEnemy)
        if (bee.pos.roomName != this.order.pos.roomName) {
          let enemies = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 1);
          if (enemies.length)
            bee.attack(enemies[0]);
          bee.goTo(this.order.pos);
        } else {
          let target: Structure | Creep = <Structure | Creep>bee.pos.findClosest(_.filter(roomInfo.enemies,
            (enemy) => enemyTargetingCurrent[enemy.id].current < enemyTargetingCurrent[enemy.id].max));
          if (target) {
            if (bee.pos.getRangeTo(target) < 3)
              bee.attack(target, { movingTarget: true });
            else
              bee.attack(target);
            if (bee.pos.isNearTo(target) && target instanceof Creep && target.getBodyParts(ATTACK)) {
              let open = bee.pos.getOpenPositions().sort((a, b) => b.getRangeTo(target) - a.getRangeTo(target));
              if (open.length)
                bee.goTo(open[0]);
            }
            enemyTargetingCurrent[target.id].current += 1;
          } else if (!bee.pos.isNearTo(this.order.pos))
            bee.goTo(this.order.pos);
        }
      else
        bee.goRest(this.hive.pos);
    });
  }
}
