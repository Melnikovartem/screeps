import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class HordeDefenseMaster extends HordeMaster {
  maxSpawns: number = 2;
  boosts = undefined;

  init() {
    Apiary.defenseSwarms[this.order.pos.roomName] = this.order;
  }

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, Infinity);
    let shouldSpawn = Game.time >= roomInfo.safeModeEndTime - 250 && roomInfo.dangerlvlmax > 2;

    if (!this.beesAmount && (!shouldSpawn || this.hive.cells.defense.reposessFlag(this.order.pos, roomInfo.dangerlvlmax) === OK)) {
      this.order.delete();
      return;
    }

    if (shouldSpawn && this.checkBees(this.hive.state !== hiveStates.battle)) {
      let order = {
        setup: setups.defender.normal,
        priority: <1 | 4 | 8>1,
      }

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      let enemy = Apiary.intel.getEnemy(this.order.pos);
      if (enemy instanceof Creep) {
        order.setup = setups.defender.normal.copy();
        order.setup.fixed = [];
        let stats = Apiary.intel.getComplexStats(enemy, undefined, 8);
        let healNeeded = Math.ceil(stats.max.dmgRange / HEAL_POWER * 0.75);
        let rangedNeeded = Math.ceil(stats.max.heal / RANGED_ATTACK_POWER + 0.25); // we dont wanna play the 0 sum game
        let desiredTTK = 40; // desired time to kill

        let healMax = 5;
        let noFear = enemy.owner.username === "Invader" || roomInfo.dangerlvlmax < 4;
        if (noFear)
          healMax = 2;
        if (healNeeded > healMax) {
          healNeeded = healMax;
          desiredTTK = 20;
        }
        let killFastRangeNeeded = Math.ceil(stats.max.hits / (RANGED_ATTACK_POWER * desiredTTK));
        order.setup = setups.defender.normal.copy();
        order.setup.patternLimit = Math.min(Math.max(killFastRangeNeeded, rangedNeeded), rangedNeeded * 2, 20);
        if (healNeeded) {
          let healCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
          if (this.hive.room.energyCapacityAvailable < toughCost + healCost * healNeeded + rangedCost * order.setup.patternLimit)
            healNeeded = 1;
          if (this.hive.room.energyCapacityAvailable >= toughCost + healCost * healNeeded + rangedCost * 2)
            order.setup.fixed = order.setup.fixed.concat(Array(healNeeded).fill(HEAL));
        }

        if (!noFear && order.setup.patternLimit * RANGED_ATTACK_POWER <= stats.max.heal)
          return;

        /* if (noFear) {
          order.setup.fixed.push(ATTACK);
          if (order.setup.patternLimit > 1)
            --order.setup.patternLimit;
        } */
      } else {
        order.priority = 8;
        order.setup = setups.defender.destroyer;
      }

      if (this.order.pos.roomName !== this.hive.roomName)
        order.priority = <4 | 8>Math.min(4, order.priority);
      this.wish(order);
    }
  }
}
