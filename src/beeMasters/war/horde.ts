import { SwarmMaster } from "../_SwarmMaster";

// import { towerCoef } from "../../abstract/utils";
import { setups } from "../../bees/creepsetups";
import { beeStates, roomStates, enemyTypes } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { Order } from "../../order";

const BOOST_LVL = 2;

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster {
  // failsafe
  maxSpawns: number = 1;
  movePriority = <3 | 4>4;
  boosts: Boosts | undefined = [{ type: "rangedAttack", lvl: BOOST_LVL }, { type: "attack", lvl: BOOST_LVL }
    , { type: "heal", lvl: BOOST_LVL }, { type: "fatigue", lvl: BOOST_LVL }, { type: "damage", lvl: BOOST_LVL },
  { type: "dismantle", lvl: 2 }, { type: "dismantle", lvl: 1 }, { type: "dismantle", lvl: 0 }];
  notify = false;
  holdPosition = false;
  setup = setups.knight.copy();
  emergency = false;

  constructor(order: Order) {
    super(order);
    this.init();
  }

  init() {
    this.emergency = this.hive.roomName === this.pos.roomName;
    if (this.order.ref.includes("hold"))
      this.holdPosition = true;
    if (!this.order.ref.includes("boost"))
      this.boosts = undefined;
    if (this.order.ref.includes("harass")) {
      this.maxSpawns = 8; // ~ 10H of non stop harass max ~ 10K energy
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.order.ref.includes("dismantle"))
      this.setup = setups.dismantler.copy();
    else if (this.order.ref.includes("destroyer")) {
      this.movePriority = 3;
      this.setup = setups.defender.destroyer.copy();
      this.setup.fixed = [TOUGH, TOUGH, TOUGH];
    } else if (this.boosts) {
      this.setup.patternLimit = 5;
      this.setup.fixed = [TOUGH, HEAL, HEAL];
    }
    if (this.order.ref.includes("keep"))
      this.maxSpawns = Infinity;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    if (this.checkBees(this.emergency) && (Game.time >= roomInfo.safeModeEndTime - 250)) {
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
    if (bee.pos.roomName === this.pos.roomName)
      opts.maxRooms = 1;
    let beeStats = Apiary.intel.getStats(bee.creep).current;
    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    if (beeStats.dmgRange > 0) {
      if (rangeToTarget <= 3 && !(target instanceof Structure))
        action2 = () => bee.rangedAttack(target!);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.object.pos.getRangeTo(bee) <= 3);
        let tempNoRamp = tempTargets.filter(e => !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length);
        if (tempNoRamp.length)
          tempTargets = tempNoRamp;
        if (tempTargets.length) {
          let tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0)
              ans = prev.dangerlvl - curr.dangerlvl;
            if (ans === 0)
              ans = bee.pos.getRangeTo(curr.object) - bee.pos.getRangeTo(prev.object);
            return ans < 0 ? curr : prev;
          });
          action2 = () => bee.rangedAttack(tempTarget.object);
        }
      }
    }

    if (beeStats.dism > 0) {
      if (rangeToTarget <= 1 && target instanceof Structure)
        action1 = () => bee.dismantle(target);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.type === enemyTypes.static && e.object.pos.getRangeTo(bee) <= 1);
        if (tempTargets.length) {
          let tempTarget = tempTargets.reduce((prev, curr) => prev.dangerlvl < curr.dangerlvl ? curr : prev);
          action1 = () => bee.dismantle(<Structure>tempTarget.object);
        }
      }
    } else if (beeStats.dmgClose > 0) {
      if (rangeToTarget <= 1)
        action1 = () => bee.attack(target!);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.object.pos.getRangeTo(bee) <= 1);
        let tempNoRamp = tempTargets.filter(e => !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length);
        if (tempNoRamp.length)
          tempTargets = tempNoRamp;
        if (tempTargets.length) {
          let tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0)
              ans = prev.dangerlvl - curr.dangerlvl;
            if (ans === 0)
              ans = bee.pos.getRangeTo(curr.object) - bee.pos.getRangeTo(prev.object);
            return ans < 0 ? curr : prev;
          });
          action1 = () => bee.attack(tempTarget.object);
        }
      }
    }

    if (beeStats.heal > 0) {
      let healingTarget: Creep | Bee | PowerCreep | null = bee.hits < bee.hitsMax ? bee : null;
      if (!healingTarget)
        healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

      if (!healingTarget && roomInfo.dangerlvlmax > 3)
        healingTarget = bee;

      let rangeToHealingTarget = healingTarget ? bee.pos.getRangeTo(healingTarget) : Infinity;
      if (rangeToHealingTarget <= 1 && (!action1 || beeStats.heal > beeStats.dism + beeStats.dmgClose)) {
        action1 = () => bee.heal(healingTarget!)
      } else if (rangeToHealingTarget <= 3 && beeStats.heal > beeStats.dmgRange && (!action2 || healingTarget && healingTarget.hits < healingTarget.hitsMax))
        action2 = () => bee.rangedHeal(healingTarget!);
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
      let enemyTTK;
      let myTTK;
      if (beeStats.dmgClose && !myInfo.dmgRange && enemyInfo.dmgRange && rangeToTarget > 1)
        myTTK = Infinity;
      else
        myTTK = enemyInfo.hits / (myInfo.dmgClose + myInfo.dmgRange - Math.min(enemyInfo.resist, enemyInfo.heal * 0.7 / 0.3) - enemyInfo.heal);
      if (beeStats.dmgRange && !enemyInfo.dmgRange)
        enemyTTK = Infinity;
      else {
        let enemyDmg = enemyInfo.dmgRange + (beeStats.dmgRange && !beeStats.dmgClose && rangeToTarget > 1 ? 0 : enemyInfo.dmgClose)
        enemyTTK = myInfo.hits / (enemyDmg - Math.min(myInfo.resist, myInfo.heal * 0.7 / 0.3) - myInfo.heal);
      }
      if (enemyTTK < 0)
        enemyTTK = Infinity;
      if (myTTK < 0)
        myTTK = Infinity;
      loosingBattle = myTTK === Infinity || enemyTTK < myTTK;

      if (beeStats.dmgClose) {
        attackRange = 2;
      } else if (beeStats.dmgRange) {
        if (enemyInfo.dmgClose)
          attackRange = !loosingBattle && enemyInfo.dmgClose > beeStats.heal ? 5 : 3;
        else if (enemyInfo.dmgRange)
          attackRange = 4;
        else
          attackRange = 2;
      } else
        attackRange = 4;

      if (loosingBattle)
        if (enemyInfo.dmgRange > myInfo.heal)
          targetedRange = 5;
        else
          targetedRange = 3;
      else
        targetedRange = attackRange;
    }

    if (!loosingBattle && (bee.hits > bee.hitsMax * 0.3 || !beeStats.heal))
      targetedRange -= 2;

    if (this.holdPosition || !target)
      return OK;

    let shouldFlee = rangeToTarget < targetedRange;
    if (!shouldFlee && loosingBattle) {
      let enterance = bee.pos.getEnteranceToRoom();
      shouldFlee = !!enterance && enterance.roomName === target.pos.roomName;
    }

    if (shouldFlee) {
      opts.maxRooms = 1;
      bee.flee(this.order, opts); // loosingBattle && bee.pos.getRoomRangeTo(this.hive) <= 2 ? this.hive :
      return ERR_BUSY;
    }
    if (loosingBattle && bee.pos.roomName === this.pos.roomName) {
      let newEnemy = bee.pos.findClosest(roomInfo.enemies.filter(e => {
        if (!(e.object instanceof Creep))
          return false;
        let stats = Apiary.intel.getStats(e.object).max;
        return !(stats.dmgClose + stats.dmgRange) && (beeStats.dmgClose + beeStats.dmgRange < stats.heal);
      }).map(e => e.object));
      if (newEnemy) {
        loosingBattle = false;
        targetedRange = 1;
        bee.memory._trav.path = undefined;
        bee.goTo(newEnemy, bee.getFleeOpt(opts));
        return OK;
      }
    }
    if (rangeToTarget > targetedRange && bee.hits > bee.hitsMax * 0.75) {
      opts.movingTarget = rangeToTarget <= targetedRange + 1;
      bee.goTo(target, opts);
      if (bee.targetPosition && bee.targetPosition.getEnteranceToRoom() && bee.pos.roomName === this.pos.roomName)
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
          if (bee.pos.roomName !== this.pos.roomName)
            pos = this.pos;
          enemy = Apiary.intel.getEnemy(pos, 10);
          if (!enemy) {
            bee.goRest(this.pos);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          } else {
            let beeStats = Apiary.intel.getStats(bee.creep).current;
            if (beeStats.dism)
              enemy = Apiary.intel.getEnemyStructure(pos);
            else
              enemy = Apiary.intel.getEnemy(pos);
            this.beeAct(bee, enemy);
          }
          break;
        case beeStates.chill:
          enemy = Apiary.intel.getEnemy(bee.pos, 10);
          let ans: number = OK;
          if (enemy) {
            enemy = Apiary.intel.getEnemy(bee.pos);
            if (enemy && bee.pos.getRangeTo(enemy) > 3)
              enemy = undefined;
          }
          ans = this.beeAct(bee, enemy);
          if (bee.pos.roomName === this.pos.roomName)
            bee.state = beeStates.work;
          if (ans === OK) {
            let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
            let opt = this.hive.opts;
            if (roomInfo.roomState >= roomStates.reservedByEnemy)
              opt.useFindRoute = true;
            bee.goTo(this.pos, opt);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          }
      }
    });
  }
}
