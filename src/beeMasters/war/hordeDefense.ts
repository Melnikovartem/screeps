import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

// most basic of bitches a horde full of wasps
@profile
export class HordeDefenseMaster extends HordeMaster {
  boosts = undefined;

  init() {
    Apiary.defenseSwarms[this.order.pos.roomName] = this.order;
  }

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, Infinity);
    let shouldSpawn = Game.time >= roomInfo.safeModeEndTime - 250 && roomInfo.dangerlvlmax > 2;

    if (shouldSpawn) {
      let order = {
        setup: setups.defender.normal.copy(),
        priority: <1 | 4 | 7 | 8>1,
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

        let noFear = enemy.owner.username === "Invader" || roomInfo.dangerlvlmax < 4;
        if (!noFear)
          desiredTTK = 20;
        if (healNeeded > 5)
          healNeeded = 5;
        let killFastRangeNeeded = Math.ceil(stats.max.hits / (RANGED_ATTACK_POWER * desiredTTK));
        order.setup = setups.defender.normal.copy();
        order.setup.patternLimit = Math.min(Math.max(killFastRangeNeeded, rangedNeeded), rangedNeeded * 3);
        if (healNeeded) {
          let healCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
          if (this.hive.room.energyCapacityAvailable < toughCost + healCost * healNeeded + rangedCost * order.setup.patternLimit)
            healNeeded = 1;
          if (this.hive.room.energyCapacityAvailable >= toughCost + healCost * healNeeded + rangedCost * 2)
            order.setup.fixed = order.setup.fixed.concat(Array(healNeeded).fill(HEAL));
        }

        if (!noFear) {
          let body = order.setup.getBody(this.hive.bassboost && this.hive.bassboost.room.energyCapacityAvailable || this.hive.room.energyCapacityAvailable).body;
          let myTTK = stats.max.hits / (body.filter(b => b === RANGED_ATTACK).length * RANGED_ATTACK_POWER - stats.max.heal);
          let enemyTTK = body.length * 100 / (stats.max.dmgRange - body.filter(b => b === HEAL).length * HEAL_POWER);
          if (enemyTTK < 0)
            enemyTTK = Infinity;
          if (myTTK < 0)
            myTTK = Infinity;
          let loosingBattle = myTTK === Infinity || enemyTTK < myTTK;
          if (loosingBattle)
            return;
        }
      } else if (enemy instanceof Structure) {
        order.priority = 7;
        order.setup = setups.defender.destroyer;
      } else
        return;
      if (this.hive.cells.defense.reposessFlag(this.order.pos, enemy) === OK) {
        this.order.delete();
        return;
      }
      if (!this.checkBees(this.hive.state !== hiveStates.battle || this.order.pos.roomName === this.hive.roomName))
        return;
      if (this.order.pos.roomName !== this.hive.roomName)
        order.priority = <4 | 7>Math.max(4, order.priority);
      this.wish(order);
      return;
    }
    if (!this.beesAmount)
      this.order.delete();
  }
}
