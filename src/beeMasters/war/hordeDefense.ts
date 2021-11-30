import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

import { hiveStates, roomStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import type { Boosts } from "../_Master";

// most basic of bitches a horde full of wasps

@profile
export class HordeDefenseMaster extends HordeMaster {
  boosts: Boosts | undefined = undefined;
  maxSpawns = 3;

  init() {
    let defSwarm = Apiary.defenseSwarms[this.pos.roomName];
    if (defSwarm && defSwarm.ref !== this.order.ref)
      this.order.delete();
    else
      Apiary.defenseSwarms[this.pos.roomName] = this.order;
  }

  update() {
    SwarmMaster.prototype.update.call(this);

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    let shouldSpawn = Game.time >= roomInfo.safeModeEndTime - 250 && roomInfo.dangerlvlmax > 2;

    let isSKraid = (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral) && roomInfo.dangerlvlmax === 5;
    if (isSKraid)
      this.boosts = [{ type: "rangedAttack", lvl: 2 }, { type: "damage", lvl: 2 }];


    if (shouldSpawn) {
      if (!this.checkBees(this.hive.state !== hiveStates.battle || this.pos.roomName === this.hive.roomName))
        return;
      let order = {
        setup: setups.defender.normal.copy(),
        priority: <1 | 4 | 7 | 8>1,
      }
      let roomInfo = Apiary.intel.getInfo(this.pos.roomName, 20);
      let enemy = Apiary.intel.getEnemy(this.pos, 20);
      if (isSKraid) {
        let getUsed = this.hive.cells.storage && this.hive.cells.storage.getUsedCapacity;
        order.setup.scheme = 1;
        if (getUsed && getUsed(BOOST_MINERAL.damage[2]) >= LAB_BOOST_MINERAL * 2 && getUsed(BOOST_MINERAL.rangedAttack[2]) >= LAB_BOOST_MINERAL * 10) {
          order.setup.patternLimit = 10;
          order.setup.fixed = [TOUGH, TOUGH, HEAL, HEAL, HEAL];
        } else {
          order.setup.patternLimit = Infinity;
          order.setup.fixed = Array(10).fill(HEAL);
        }
      } else if (enemy instanceof Creep) {
        order.setup.fixed = [];
        let stats = Apiary.intel.getComplexStats(enemy, undefined, 8);
        let healNeeded = Math.ceil(stats.max.dmgRange / HEAL_POWER * 0.75);
        let rangedNeeded = Math.ceil(stats.max.heal / RANGED_ATTACK_POWER + 0.25); // we dont wanna play the 0 sum game
        let desiredTTK = 20; // desired time to kill

        let noFear = enemy.owner.username === "Invader" || roomInfo.dangerlvlmax < 4;
        if (enemy.owner.username === "Invader")
          desiredTTK = 10;
        if (healNeeded > 5)
          healNeeded = 5;
        let killFastRangeNeeded = Math.ceil(stats.max.hits / (RANGED_ATTACK_POWER * desiredTTK));
        order.setup = setups.defender.normal.copy();
        order.setup.patternLimit = Math.min(Math.max(killFastRangeNeeded, rangedNeeded) / (this.boosts ? 4 * 0.5 : 1), roomInfo.dangerlvlmax >= 4 ? 25 : 10); // Math.max(rangedNeeded * 3, 6) -> 25

        if (healNeeded) {
          let healCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
          let toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
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
        order.setup = setups.defender.destroyer.copy();
        order.setup.patternLimit = 10;
      } else
        return;
      if (this.hive.cells.defense.reposessFlag(this.pos, enemy) === OK) {
        this.order.delete();
        return;
      }
      if (this.pos.roomName !== this.hive.roomName)
        order.priority = <4 | 7>Math.max(4, order.priority);
      this.wish(order);
      return;
    }
    if (!this.beesAmount)
      this.order.delete();
  }
}
