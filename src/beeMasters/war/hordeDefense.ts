import { HordeMaster } from "./horde";
import { SwarmMaster } from "../_SwarmMaster";

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

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName);
    if (roomInfo.dangerlvlmax < 3 && !this.beesAmount) {
      this.order.delete();
      return;
    }

    if (this.checkBees() && (Game.time >= roomInfo.safeModeEndTime - 250) && roomInfo.dangerlvlmax > 2) {
      let order = {
        setup: setups.defender.normal,
        priority: <1 | 4 | 8>1,
      }

      let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, 25);

      if (roomInfo.dangerlvlmax < 4) {
        order.priority = 8;
        order.setup = setups.defender.destroyer.copy();
      } else {
        let enemy = Apiary.intel.getEnemy(this.order.pos);
        if (enemy instanceof Creep) {
          let stats = Apiary.intel.getComplexStats(enemy);
          let healNeeded = Math.ceil(stats.max.dmgRange / HEAL_POWER * 0.5);
          let rangedNeeded = Math.ceil(stats.max.heal / RANGED_ATTACK_POWER);
          let desiredTTK = 40; // desired time to kill
          if (healNeeded > 3) {
            healNeeded = 3;
            desiredTTK = 20;
          }
          let killFastRangeNeeded = Math.ceil(stats.max.hits / (RANGED_ATTACK_POWER * desiredTTK));

          order.setup = setups.defender.normal.copy();
          order.setup.patternLimit = Math.min(Math.max(rangedNeeded, killFastRangeNeeded, 2), 16);
          if (healNeeded) {
            let healCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
            let rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
            let toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
            if (this.hive.room.energyCapacityAvailable < toughCost + healCost * healNeeded + rangedCost * order.setup.patternLimit)
              healNeeded = 1;
            if (this.hive.room.energyCapacityAvailable >= toughCost + healCost * healNeeded + rangedCost * 2)
              order.setup.fixed = order.setup.fixed.concat(Array(healNeeded).fill(HEAL));
          }
        }
      }

      if (this.order.pos.roomName !== this.hive.roomName)
        order.priority = <4 | 8>Math.min(4, order.priority);
      this.wish(order);
    }
  }
}
