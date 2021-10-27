import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";

// most basic of bitches a horde full of wasps

const ticksToSpawn = (x: StructureKeeperLair) => x.ticksToSpawn ? x.ticksToSpawn : 0;

@profile
export class SKMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = Infinity;
  lairs: StructureKeeperLair[] = [];
  boosts: Boosts = [{ type: "rangedAttack", lvl: 0, amount: 6 }, { type: "fatigue", lvl: 0, amount: 5 }];

  update() {
    super.update();

    if (this.order.pos.roomName in Game.rooms) {
      if (!this.lairs.length) {
        this.lairs = <StructureKeeperLair[]>Game.rooms[this.order.pos.roomName].find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } });
        if (!this.lairs.length)
          this.order.delete(true);
      }

      for (let i = 0; i < this.lairs.length; ++i)
        this.lairs[i] = <StructureKeeperLair>Game.getObjectById(this.lairs[i].id);
    }

    if (this.checkBees(false, CREEP_LIFE_TIME - 150) && (!this.hive.bassboost || this.order.pos.getRoomRangeTo(this.hive.bassboost, true) < 5)) {
      this.wish({
        setup: setups.defender.sk,
        priority: 6,
      });
    }
  }

  attackOrFlee(bee: Bee, target: Creep | Structure) {
    bee.target = target.id;
    let shouldFlee = (bee.pos.getRangeTo(target) < 3)
      || (bee.pos.getRangeTo(target) < 4 && bee.hits <= bee.hitsMax * 0.65);
    if (!shouldFlee || bee.pos.getRangeTo(target) <= 3)
      bee.rangedAttack(target, { movingTarget: true });
    if (shouldFlee)
      return bee.flee(this.hive);
    return OK;
  }

  useLair(bee: Bee, lair: StructureKeeperLair) {
    let enemy;

    if (ticksToSpawn(lair) < 1) {
      enemy = lair.pos.findClosest(lair.pos.findInRange(FIND_HOSTILE_CREEPS, 5));
      if (enemy)
        this.attackOrFlee(bee, enemy);
    }

    if (!enemy) {
      enemy = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 3)[0];
      let ans: number = OK;
      if (enemy)
        ans = this.attackOrFlee(bee, enemy);
      if (ans === OK)
        bee.goTo(lair, { range: 3 });
      bee.target = lair.id;
    }
  }

  run() {
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting && (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK))
        bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (bee.hits < bee.hitsMax)
        bee.heal(bee);
      else if (bee.pos.roomName === this.order.pos.roomName) {
        let healingTarget = bee.pos.findClosest(bee.pos.findInRange(FIND_MY_CREEPS, 3).filter(b => b.hits < b.hitsMax));
        if (healingTarget)
          if (bee.pos.isNearTo(healingTarget))
            bee.heal(healingTarget);
          else
            bee.rangedHeal(healingTarget);
      }

      if (bee.state === beeStates.boosting)
        return;

      if (bee.pos.roomName !== this.order.pos.roomName) {
        let ans: number = OK;
        let enemy = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 3)[0];
        if (enemy)
          ans = this.attackOrFlee(bee, enemy);
        if (ans === OK)
          bee.goTo(this.order.pos);
        return;
      }

      if (bee.target) {
        let target = <Creep | Structure>Game.getObjectById(bee.target);
        if (target instanceof Creep) {
          // update the enemies
          Apiary.intel.getInfo(this.order.pos.roomName);
          this.attackOrFlee(bee, target);
          return;
        } else if (target instanceof StructureKeeperLair) {
          this.useLair(bee, target);
          return;
        } else
          bee.target = undefined;
      }

      if (!this.lairs.length)
        return;

      let lair = this.lairs.reduce((prev, curr) => {
        let ans = ticksToSpawn(curr) - ticksToSpawn(prev);
        if (ans === 0)
          ans = curr.pos.getRangeTo(bee) - prev.pos.getRangeTo(bee);
        return ans < 0 ? curr : prev;
      });

      this.useLair(bee, lair);
    });
  }
}
