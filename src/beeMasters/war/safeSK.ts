import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { FlagOrder } from "../../order";

const ticksToSpawn = (x: StructureKeeperLair) => x.ticksToSpawn ? x.ticksToSpawn : 0;

@profile
export class SKMaster extends HordeMaster {
  // failsafe
  lairs: StructureKeeperLair[] = [];

  constructor(order: FlagOrder) {
    super(order);
  }

  init() { }

  get targetBeeCount() { return 1; }

  set targetBeeCount(_) { }

  get maxSpawns() { return Infinity; }

  set maxSpawns(_) { }

  update() {
    SwarmMaster.prototype.update.call(this);

    if (this.pos.roomName in Game.rooms) {
      if (!this.lairs.length) {
        this.lairs = <StructureKeeperLair[]>Game.rooms[this.pos.roomName].find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } });
        /* if (!this.lairs.length)
          this.order.delete(); */
      }

      if (!this.maxPath && this.lairs.length) {
        let max = 0;
        _.forEach(this.lairs, lair => {
          let time = this.hive.pos.getTimeForPath(lair);
          if (max < time)
            max = time;
        });
        this.maxPath = max;
      }

      for (let i = 0; i < this.lairs.length; ++i)
        this.lairs[i] = <StructureKeeperLair>Game.getObjectById(this.lairs[i].id);
    }

    if (this.hive.bassboost)
      return;

    if (!this.hive.annexInDanger.includes(this.pos.roomName) &&
      this.checkBees(this.hive.state !== hiveStates.battle && this.hive.state !== hiveStates.lowenergy, CREEP_LIFE_TIME - this.maxPath - 50)
      && Apiary.intel.getInfo(this.pos.roomName).dangerlvlmax < 8)
      this.wish({
        setup: setups.defender.sk,
        priority: 4,
      });
  }

  useLair(bee: Bee, lair: StructureKeeperLair) {
    if (ticksToSpawn(lair) < 1) {
      let enemy = lair.pos.findClosest(lair.pos.findInRange(FIND_HOSTILE_CREEPS, 5).filter(e => e.owner.username === "Source Keeper"));
      if (enemy) {
        Apiary.intel.getInfo(bee.pos.roomName);
        this.attackOrFleeSK(bee, enemy);
        return;
      }
    }
    let enemy = Apiary.intel.getEnemy(bee.pos, 10);
    let ans: number = OK;
    if (enemy instanceof Creep && (enemy.pos.getRangeTo(lair) <= 5 || enemy.pos.getRangeTo(bee) <= 3)) {
      ans = this.attackOrFleeSK(bee, enemy);
      Apiary.intel.getInfo(bee.pos.roomName);
    }
    if (ans === OK)
      bee.goTo(lair, { range: 2 });
    bee.target = lair.id;

  }

  attackOrFleeSK(bee: Bee, target: Creep) {
    // worse version of beeAct
    bee.target = target.id;
    if (bee.pos.getRangeTo(target) <= 4 || bee.hits < bee.hitsMax)
      bee.heal(bee);
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

      if (bee.pos.roomName !== this.pos.roomName && !bee.target) {
        let ans: number = OK;
        let enemy = Apiary.intel.getEnemy(bee.pos, 20);
        if (enemy && enemy.pos.getRangeTo(bee) <= 3)
          ans = this.beeAct(bee, enemy);
        if (ans === OK)
          bee.goTo(this.pos);
        return;
      }

      let target = <Creep | Structure | undefined>(bee.target && Game.getObjectById(bee.target));
      let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 20);
      if (roomInfo.dangerlvlmax >= 4) {
        let defSquad = Apiary.defenseSwarms[this.pos.roomName];
        let pos = defSquad && defSquad.activeBees.filter(b => b.pos.roomName === this.pos.roomName)[0];
        let enemy = Apiary.intel.getEnemy(pos && pos.pos || bee.pos);
        if (enemy) {
          // killer mode
          this.beeAct(bee, enemy);
          return;
        }
      }


      if (target instanceof Creep) {
        // update the enemies
        this.attackOrFleeSK(bee, target);
        return;
      }

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

      if (target instanceof StructureKeeperLair) {
        this.useLair(bee, target);
        return;
      } else
        bee.target = undefined;

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
