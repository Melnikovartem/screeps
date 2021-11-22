import { HordeMaster } from "./horde";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Order } from "../../order";

const ticksToSpawn = (x: StructureKeeperLair) => x.ticksToSpawn ? x.ticksToSpawn : 0;

@profile
export class SKMaster extends HordeMaster {
  // failsafe
  maxSpawns: number = Infinity;
  lairs: StructureKeeperLair[] = [];

  constructor(order: Order) {
    super(order);
  }

  update() {
    super.update();

    if (this.pos.roomName in Game.rooms) {
      if (!this.lairs.length) {
        this.lairs = <StructureKeeperLair[]>Game.rooms[this.pos.roomName].find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } });
        if (!this.lairs.length)
          this.order.delete();
      }

      if (!this.order.memory.extraInfo && this.lairs.length) {
        let max = 0;
        _.forEach(this.lairs, lair => {
          let time = this.hive.pos.getTimeForPath(lair);
          if (max < time)
            max = time;
        });
        this.order.memory.extraInfo = max;
      }

      for (let i = 0; i < this.lairs.length; ++i)
        this.lairs[i] = <StructureKeeperLair>Game.getObjectById(this.lairs[i].id);
    }

    if (this.hive.bassboost && this.pos.getRoomRangeTo(this.hive.bassboost, true) > 5)
      return;

    if (this.checkBees(this.hive.state !== hiveStates.battle && this.hive.state !== hiveStates.lowenergy, CREEP_LIFE_TIME - this.order.memory.extraInfo - 50))
      this.wish({
        setup: setups.defender.sk,
        priority: 4,
      });
  }

  useLair(bee: Bee, lair: StructureKeeperLair) {
    let enemy;

    if (ticksToSpawn(lair) < 1) {
      enemy = lair.pos.findClosest(lair.pos.findInRange(FIND_HOSTILE_CREEPS, 5).filter(e => e.owner.username === "Source Keeper"));
      if (enemy)
        this.attackOrFleeSK(bee, enemy);
    }

    if (!enemy) {
      enemy = Apiary.intel.getEnemyCreep(bee.pos, 10);
      let ans: number = OK;
      if (enemy && (enemy.pos.getRangeTo(lair) <= 5 || enemy.pos.getRangeTo(bee) <= 3))
        ans = this.attackOrFleeSK(bee, enemy);
      if (ans === OK)
        bee.goTo(lair, { range: 2 });
      bee.target = lair.id;
    }
  }

  attackOrFleeSK(bee: Bee, target: Creep | Structure) {
    // worse version of beeAct
    bee.target = target.id;
    let shouldFlee = (bee.pos.getRangeTo(target) < 3)
      || (bee.pos.getRangeTo(target) <= 4 && bee.hits <= bee.hitsMax * 0.65);
    if (!shouldFlee || bee.pos.getRangeTo(target) <= 3)
      bee.rangedAttack(target, { movingTarget: true });
    if (shouldFlee)
      return bee.flee(new RoomPosition(25, 25, this.pos.roomName));
    return OK;
  }

  run() {

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;

      if (bee.pos.roomName !== this.pos.roomName) {
        let ans: number = OK;
        let enemy = Apiary.intel.getEnemy(bee.pos, 10);
        if (enemy && enemy.pos.getRangeTo(bee) <= 5)
          ans = this.beeAct(bee, enemy);
        if (ans === OK)
          bee.goTo(this.pos);
        return;
      }

      let roomInfo = Apiary.intel.getInfo(this.pos.roomName, 10);
      if (roomInfo.dangerlvlmax >= 4) {
        let defSquad = Apiary.defenseSwarms[this.pos.roomName] && Apiary.defenseSwarms[this.pos.roomName].master;
        let pos = defSquad && defSquad.activeBees.filter(b => b.pos.roomName === this.pos.roomName)[0];
        let enemy = Apiary.intel.getEnemy(pos && pos.pos || bee.pos);
        if (enemy) {
          // killer mode
          this.beeAct(bee, enemy);
          return;
        }
      }

      // attackOrFlee doesn't heal so we heal here
      if (bee.hits < bee.hitsMax)
        bee.heal(bee);
      else if (bee.pos.roomName === this.pos.roomName) {
        let healingTarget = bee.pos.findClosest(bee.pos.findInRange(FIND_MY_CREEPS, 3).filter(b => b.hits < b.hitsMax));
        if (healingTarget)
          if (bee.pos.isNearTo(healingTarget))
            bee.heal(healingTarget);
          else
            bee.rangedHeal(healingTarget);
      }

      if (bee.target) {
        let target = <Creep | Structure>Game.getObjectById(bee.target);
        if (target instanceof Creep) {
          // update the enemies
          this.attackOrFleeSK(bee, target);
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
