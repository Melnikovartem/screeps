import { SwarmMaster } from "../_SwarmMaster";

// import { towerCoef } from "../../abstract/utils";
import { setups } from "../../bees/creepsetups";
import { beeStates, roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { Order } from "../../order";

const BOOST_LVL = 0;

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 1;
  movePriority = <3>3;
  boosts: Boosts | undefined = [{ type: "rangedAttack", lvl: BOOST_LVL }, { type: "attack", lvl: BOOST_LVL }
    , { type: "heal", lvl: BOOST_LVL }, { type: "fatigue", lvl: BOOST_LVL }, { type: "damage", lvl: BOOST_LVL },
  { type: "dismantle", lvl: 2 }, { type: "dismantle", lvl: 1 }, { type: "dismantle", lvl: 0 }];
  notify = false;
  holdPosition = false;
  setup = setups.knight.copy();

  constructor(order: Order) {
    super(order);
    this.init();
  }

  init() {
    if (this.order.ref.includes("hold"))
      this.holdPosition = true;
    if (!this.order.ref.includes("boost"))
      this.boosts = undefined;
    if (this.order.ref.includes("harass")) {
      this.maxSpawns = Infinity;
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.order.ref.includes("dismantle"))
      this.setup = setups.dismantler.copy();
    else if (this.order.ref.includes("destroyer")) {
      this.setup = setups.defender.destroyer.copy();
      this.setup.fixed = [TOUGH, TOUGH, TOUGH];
    }
    if (this.order.ref.includes("keep"))
      this.maxSpawns = Infinity;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.order.pos.roomName, Infinity);
    if (this.checkBees() && (Game.time >= roomInfo.safeModeEndTime - 250)) {
      this.wish({
        setup: this.setup,
        priority: 4,
      });
    }
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep | undefined) {
    let action1;
    let action2;

    let opts: TravelToOptions = {};
    if (bee.pos.roomName === this.order.pos.roomName)
      opts.maxRooms = 1;
    let beeStats = Apiary.intel.getStats(bee.creep).current;
    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);

    let healingTarget: Creep | Bee | PowerCreep | undefined | null;
    if (bee.hits < bee.hitsMax)
      healingTarget = bee;

    if (beeStats.heal > 0 && !healingTarget)
      healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    let rangeToHealingTarget = healingTarget ? bee.pos.getRangeTo(healingTarget) : Infinity;

    if (rangeToTarget <= 3 && beeStats.dmgRange > 0)
      action2 = () => bee.rangedAttack(target);
    else if (rangeToHealingTarget <= 3 && rangeToHealingTarget > 1 && beeStats.heal > 0)
      action2 = () => bee.rangedHeal(healingTarget);
    else if (roomInfo.roomState >= roomStates.reservedByEnemy && beeStats.dmgRange > 0) {
      let tempTarget: Structure | Creep | null = bee.pos.findClosest(bee.pos.findInRange(FIND_HOSTILE_CREEPS, 3));
      if (!tempTarget)
        tempTarget = bee.pos.findClosest(bee.pos.findInRange(FIND_STRUCTURES, 3));
      if (tempTarget)
        action2 = () => bee.rangedAttack(tempTarget);
    }

    if (rangeToHealingTarget <= 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget);
    else if (beeStats.dism > 0 || beeStats.dmgClose > 0) {
      if (rangeToTarget === 1)
        if (beeStats.dism > 0 && target instanceof Structure)
          action1 = () => bee.dismantle(target);
        else if (beeStats.dmgClose > 0)
          action1 = () => bee.attack(target);
      if (!action1) {
        let tempTarget: Structure | Creep | undefined;
        if (beeStats.dism > 0)
          tempTarget = bee.pos.findInRange(FIND_HOSTILE_STRUCTURES, 1)[0];
        if (!tempTarget)
          tempTarget = bee.pos.findInRange(FIND_HOSTILE_CREEPS, 1)[0];
        if (!tempTarget && beeStats.dism === 0)
          tempTarget = bee.pos.findInRange(FIND_HOSTILE_STRUCTURES, 1)[0];
        if (tempTarget)
          if (beeStats.dism > 0 && target instanceof Structure)
            action1 = () => bee.dismantle(target);
          else if (beeStats.dmgClose > 0)
            action1 = () => bee.attack(target);
      }
    }

    if (action1)
      action1();
    if (action2)
      action2();

    let targetedRange = 1;
    let loosingBattle = false;
    let attackRange = 2;
    if (target instanceof Creep) {
      let enemyInfo = Apiary.intel.getComplexStats(target).current;
      let myInfo = Apiary.intel.getComplexMyStats(bee, 5, 3).current;
      let enemyTTK = myInfo.hits / (enemyInfo.dmgClose + enemyInfo.dmgRange - myInfo.heal);
      let myTTK;
      if (beeStats.dmgClose && !myInfo.dmgRange && enemyInfo.dmgRange && rangeToTarget > 1 && target.owner.username !== "Invader")
        myTTK = Infinity;
      else
        myTTK = enemyInfo.hits / (myInfo.dmgClose + myInfo.dmgRange - enemyInfo.heal);
      if (enemyTTK < 0)
        enemyTTK = Infinity;
      if (myTTK < 0)
        myTTK = Infinity;
      loosingBattle = myTTK === Infinity || enemyTTK < myTTK;

      if (beeStats.dmgClose)
        attackRange = 2;
      else if (beeStats.dmgRange)
        attackRange = 4;
      else
        attackRange = 4;

      if (loosingBattle)
        if (enemyInfo.dmgRange > myInfo.heal)
          targetedRange = 5;
        else
          targetedRange = 3;
      else
        targetedRange = attackRange;

      //if (!enemyInfo.heal && target.owner.username === "Awaii")
      // loosingBattle = false; // not optimal code
      // if (target.owner.username === "Bulletproof")
      // loosingBattle = false; // the guy fucking crashed
    }
    /* else if (target instanceof StructureTower) {
      targetedRange = 20;
      loosingBattle = target.store.getUsedCapacity(RESOURCE_ENERGY) > bee.hitsMax / (TOWER_POWER_ATTACK * towerCoef(target, bee)) * 10 / 2; // / 2 just beacause
      if (!loosingBattle)
        targetedRange = 3;
    } */

    if (loosingBattle && bee.pos.roomName === this.order.pos.roomName) {
      let newEnemy = bee.pos.findClosest(roomInfo.enemies.filter(e => {
        if (!(e.object instanceof Creep))
          return false;
        let stats = Apiary.intel.getStats(e.object).max;
        return !(stats.dmgClose + stats.dmgRange) && (beeStats.dmgClose + beeStats.dmgRange < stats.heal);
      }).map(e => e.object));
      if (newEnemy) {
        loosingBattle = false;
        targetedRange = attackRange;
        bee.memory._trav = false;
        bee.goTo(newEnemy, bee.getFleeOpt(opts));
        return OK;
      }
    }

    if (!loosingBattle && (bee.hits > bee.hitsMax * 0.3 || !beeStats.heal))
      targetedRange -= 2;

    if (this.holdPosition || !target)
      return OK;

    if (rangeToTarget < targetedRange)
      bee.flee(loosingBattle ? this.hive : this.order, opts);
    else if (rangeToTarget > targetedRange && bee.hits > bee.hitsMax * 0.9) {
      opts.movingTarget = true;
      bee.goTo(target, opts);
      if (bee.targetPosition && bee.targetPosition.getEnteranceToRoom() && bee.pos.roomName === this.order.pos.roomName)
        bee.targetPosition = bee.pos;
    }
    // if (bee.targetPosition && this.hive.roomName === bee.pos.roomName)
    // return ERR_BUSY; // help with deff i guess
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
          let pos = bee.pos;
          if (bee.pos.roomName !== this.order.pos.roomName)
            pos = this.order.pos;
          enemy = Apiary.intel.getEnemy(pos, 10);
          enemy = Apiary.intel.getEnemy(pos);
          if (enemy instanceof Creep && enemy.body.length === 1)
            enemy = undefined;
          this.beeAct(bee, enemy);
          if (!enemy) {
            bee.goRest(this.order.pos);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          }
          break;
        case beeStates.chill:
          enemy = Apiary.intel.getEnemy(bee.pos, 10);
          let ans: number = OK;
          if (enemy && bee.pos.getRangeTo(enemy) <= 3) {
            enemy = Apiary.intel.getEnemy(bee.pos);
            if (enemy && bee.pos.getRangeTo(enemy) > 3)
              enemy = undefined;
          }
          ans = this.beeAct(bee, enemy);
          if (bee.pos.roomName === this.order.pos.roomName)
            bee.state = beeStates.work;
          if (ans === OK) {
            bee.goTo(this.order.pos);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          }
      }
    });
  }
}
