import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { Bee } from "../../bees/bee";
import { states } from "../_Master";
import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class hordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 5;

  update() {
    super.update();

    if (this.checkBees()) {
      this.wish({
        setup: Setups.knight,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 1,
      });
    }
  }

  attackOrFlee(bee: Bee, target: Creep | Structure) {
    if (bee.pos.getRangeTo(target) <= 3)
      bee.rangedAttack(target);
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
      return ERR_BUSY;
    }
    return OK;
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      Apiary.intel.getInfo(this.order.pos.roomName, 25);
      if (bee.state === states.work) {
        if (bee.pos.roomName !== this.order.pos.roomName)
          bee.state = states.chill;
        let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
        let target = bee.pos.findClosest(roomInfo.enemies);
        if (target) {
          this.attackOrFlee(bee, target);
        } else
          bee.goRest(this.order.pos);
      } else {
        let enemies = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        let ans: number = OK;
        if (enemies.length)
          ans = this.attackOrFlee(bee, enemies[0]);
        if (ans === OK) {
          bee.goTo(this.order.pos, { range: bee.pos.roomName !== this.order.pos.roomName ? 1 : 5 });
          if (bee.pos.getRangeTo(this.order.pos) <= 5)
            bee.state = states.work;
        }
      }
      if (bee.hits < bee.hitsMax)
        bee.heal(bee);
    });
  }
}
