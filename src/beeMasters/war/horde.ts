import { Bee } from "../../bee";
import { Setups } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class hordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 10;
  spawned: number = 0;

  newBee(bee: Bee) {
    super.newBee(bee);
    this.spawned += 1; // kinda loops in resets, but whatever
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (this.spawned === this.maxSpawns && !this.beesAmount && !this.waitingForBees)
      this.order.delete();

    if (this.checkBees() && this.spawned < this.maxSpawns && Game.time >= roomInfo.safeModeEndTime - 100) {
      let order: SpawnOrder = {
        setup: Setups.knight,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 1,
      };

      this.wish(order);
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    _.forEach(this.bees, (bee) => {
      if (bee.pos.roomName !== this.order.pos.roomName) {
        let enemies = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        if (enemies.length)
          bee.rangedAttack(enemies[0]);
        bee.goTo(this.order.pos);
      } else {
        let target = bee.pos.findClosest(roomInfo.enemies);
        if (target) {
          if (bee.pos.getRangeTo(target) <= 3)
            bee.rangedAttack(target, { movingTarget: true });
          else if (bee.hits === bee.hitsMax)
            bee.rangedAttack(target);
          if (bee.pos.getRangeTo(target) < 3 && target instanceof Creep || bee.hits <= bee.hitsMax * 0.7) {
            let open = bee.pos.getOpenPositions().reduce((prev, curr) => {
              let ans = prev.getRangeTo(target!) - curr.getRangeTo(target!);
              if (ans === 0)
                ans = curr.getRangeTo(this.order.pos) - prev.getRangeTo(this.order.pos)
              return ans < 0 ? curr : prev;
            });
            if (open)
              bee.goTo(open);
          }
        } else
          bee.goRest(this.order.pos);
      }
      if (bee.hits < bee.hitsMax)
        bee.heal(bee);
    });
  }
}
