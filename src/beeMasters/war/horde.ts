import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 5;
  movePriority = <2>2;
  boost = true;
  boostMove = true;
  notify = false;

  update() {
    super.update();

    if (this.checkBees(true)) {
      this.wish({
        setup: setups.knight,
        priority: 1,
      });
    }
  }

  attackOrFlee(bee: Bee, target: Creep | Structure | PowerCreep) {
    let action;
    let range = 3;
    if (bee.getActiveBodyParts(RANGED_ATTACK))
      action = () => bee.rangedAttack(target)
    if (bee.getActiveBodyParts(ATTACK)) {
      if (action)
        action = () => bee.attack(target) && bee.rangedAttack(target);
      else
        action = () => bee.attack(target);
      range = 1;
    }

    if (action)
      if (bee.pos.getRangeTo(target) <= range) {
        action();
      } else if (bee.hits === bee.hitsMax || !bee.getActiveBodyParts(HEAL))
        action();

    let targetRange = 1;
    let shouldFlee = !action;
    if (!shouldFlee)
      if (target instanceof Creep) {
        let info = Apiary.intel.getStats(target).current;
        if (info.dmgRange)
          targetRange = 3;
        else if (info.dmgClose)
          targetRange = 1;
        else
          targetRange = 0;
        shouldFlee = targetRange > 0;
      } else if (target instanceof StructureTower) {
        // prob should calc if i will be able to get out of range with current healing
        shouldFlee = target.store.getUsedCapacity(RESOURCE_ENERGY) >= 10;
        targetRange = 20;
      }
    if (shouldFlee && (bee.pos.getRangeTo(target) <= targetRange && bee.hits <= bee.hitsMax * 0.7 || bee.pos.getRangeTo(target) < range)) {
      let open = bee.pos.getOpenPositions().reduce((prev, curr) => {
        let ans = prev.getRangeTo(target!) - curr.getRangeTo(target!);
        if (ans === 0) {
          switch (Game.map.getRoomTerrain(curr.roomName).get(curr.x, curr.y)) {
            case TERRAIN_MASK_WALL:
            case TERRAIN_MASK_SWAMP:
              if (Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y) === TERRAIN_MASK_WALL)
                ans = -1;
              else
                ans = 1;
              break;
            case 0:
              if (Game.map.getRoomTerrain(prev.roomName).get(prev.x, prev.y) !== 0)
                ans = -1;
              else
                ans = curr.getRangeTo(this.order.pos) - prev.getRangeTo(this.order.pos)
              break;
          }
        }
        return ans < 0 ? curr : prev;
      });
      if (open)
        bee.goTo(open);
      return ERR_BUSY;
    }
    return OK;
  }


  run() {
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.work:
          if (bee.pos.roomName !== this.order.pos.roomName) {
            bee.state = beeStates.chill;
            break;
          }
          let target = Apiary.intel.getEnemy(bee.pos);
          if (target) {
            this.attackOrFlee(bee, target);
          } else
            bee.goRest(this.order.pos);
          break;
        case beeStates.boosting:
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "rangedAttack" }, { type: "attack" }, { type: "heal" }, { type: "fatigue" }]) === OK)
            bee.state = beeStates.chill;
          break;
        case beeStates.chill:
          let enemy = Apiary.intel.getEnemy(bee.pos, 10);
          let ans: number = OK;
          if (enemy && bee.pos.getRangeTo(enemy) <= 3) {
            enemy = Apiary.intel.getEnemy(bee.pos);
            if (enemy && bee.pos.getRangeTo(enemy) <= 3)
              ans = this.attackOrFlee(bee, enemy);
          }
          if (ans === OK) {
            bee.goTo(this.order.pos, { range: bee.pos.roomName !== this.order.pos.roomName ? 1 : 5 });
            if (bee.pos.getRangeTo(this.order.pos) <= (enemy ? 20 : 5))
              bee.state = beeStates.work;
          }
      }
      if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
        bee.heal(bee);
    });
  }
}
