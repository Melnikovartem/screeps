import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates, roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";

// most basic of bitches a horde full of wasps
@profile
export class DestroyerMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 5;

  update() {
    super.update();

    if (this.checkBees(true)) {
      let order = {
        setup: setups.destroyer,
        amount: Math.max(this.targetBeeCount - this.beesAmount, 1),
        priority: <7>7,
      };

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      if (roomInfo.roomState != roomStates.ownedByEnemy && roomInfo.dangerlvlmax < 3)
        order.setup.patternLimit = 1;

      this.wish(order);
    }
  }

  attackOrFlee(bee: Bee, target: Creep | Structure | PowerCreep) {
    if (bee.pos.isNearTo(target))
      bee.attack(target);
    else if (bee.hits === bee.hitsMax)
      bee.attack(target);
    if (bee.pos.isNearTo(target) && target instanceof Creep && bee.hits <= bee.hitsMax * 0.7) {
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
      if (bee.state === beeStates.work) {
        if (bee.pos.roomName !== this.order.pos.roomName)
          bee.state = beeStates.chill;
        let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
        let target = bee.pos.findClosest(roomInfo.enemies.map((e) => e.object));
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
            bee.state = beeStates.work;
        }
      }
    });
  }
}
