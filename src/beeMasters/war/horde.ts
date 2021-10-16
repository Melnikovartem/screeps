import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { Order } from "../../order";

const BOOST_LVL = 0;

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 5;
  movePriority = <2>2;
  boosts: Boosts | undefined = [{ type: "rangedAttack", lvl: BOOST_LVL }, { type: "attack", lvl: BOOST_LVL }
    , { type: "heal", lvl: BOOST_LVL }, { type: "fatigue", lvl: BOOST_LVL }, { type: "damage", lvl: BOOST_LVL }];
  notify = false;
  defendNearFlag = false;

  constructor(order: Order) {
    super(order);
    this.setup();
  }

  setup() {
    if (this.order.ref.includes("_hold_"))
      this.defendNearFlag = true;
    if (this.order.ref.includes("_noboost_"))
      this.boosts = undefined;
  }

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
    let range = 2;
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

    if (this.defendNearFlag)
      return OK;

    let targetRange = 1;
    let shouldFlee = !action;
    if (!shouldFlee)
      if (target instanceof Creep) {
        let info = Apiary.intel.getStats(target).current;
        if (info.dmgRange) {
          targetRange = 2;
          if (bee.hits <= bee.hitsMax * 0.7)
            targetRange = 3;
        } else if (info.dmgClose)
          targetRange = 1;
        else
          targetRange = 0;
        shouldFlee = targetRange > 0;
      } else if (target instanceof StructureTower) {
        // prob should calc if i will be able to get out of range with current healing
        shouldFlee = target.store.getUsedCapacity(RESOURCE_ENERGY) >= 10;
        targetRange = 20;
      }
    if (shouldFlee && (bee.pos.getRangeTo(target) <= targetRange && bee.hits <= bee.hitsMax * 0.85 || bee.pos.getRangeTo(target) < range))
      bee.flee(target, this.order.pos);
    return OK;
  }


  run() {
    if (this.boosts)
      _.forEach(this.bees, bee => {
        if (bee.state === beeStates.boosting && (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK))
          bee.state = beeStates.chill;
      });

    _.forEach(this.activeBees, bee => {
      let enemy;
      switch (bee.state) {
        case beeStates.work:
          enemy = Apiary.intel.getEnemy(this.order.pos);
          if (enemy && (!this.defendNearFlag || bee.pos.getRangeTo(enemy) < 3)) {
            this.attackOrFlee(bee, enemy);
          } else
            bee.goRest(this.order.pos);
          break;
        case beeStates.chill:
          enemy = Apiary.intel.getEnemy(bee.pos, 10);
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
      if (bee.getActiveBodyParts(HEAL))
        if (bee.hits < bee.hitsMax)
          bee.heal(bee);
        else if (this.defendNearFlag) {
          let healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));
          if (healingTarget)
            if (healingTarget.pos.getRangeTo(bee) <= 1)
              bee.heal(healingTarget);
            else if (!enemy)
              bee.rangedHeal(healingTarget);
        }
    });
  }
}
