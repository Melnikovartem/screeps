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
    else if (this.order.ref.includes("destroyer"))
      this.setup = setups.defender.destroyer.copy();
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
      action2 = () => bee.rangedAttack(target, opts);
    else if (rangeToHealingTarget > 1 && rangeToHealingTarget <= 3 && beeStats.heal > 0)
      action2 = () => bee.rangedHeal(healingTarget, opts);
    else if (roomInfo.roomState >= roomStates.reservedByEnemy && beeStats.dmgRange > 0
      && roomInfo.enemies.filter(e => bee.pos.getRangeTo(e.object) <= 3 && "owner" in e.object).length)
      action2 = () => bee.rangedMassAttack();

    if (rangeToHealingTarget < 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget, opts);
    else if (rangeToTarget === 1 && beeStats.dmgClose > 0)
      action1 = () => bee.attack(target, opts);
    else if (rangeToTarget === 1 && beeStats.dism > 0 && target instanceof Structure)
      action1 = () => bee.dismantle(target, opts);
    else if (rangeToHealingTarget === 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget, opts);

    if (action1)
      action1();
    if (action2)
      action2();

    let targetedRange = 1;
    let loosingBattle = false;
    let attackRange = 2;
    if (target instanceof Creep) {
      let info = Apiary.intel.getComplexStats(target).current;
      let enemyTTK;
      let myTTK;
      if (info.dmgClose >= beeStats.dmgClose) {
        targetedRange = 3;
        attackRange = 3;
        enemyTTK = info.hits / (beeStats.dmgRange - info.heal);
        myTTK = beeStats.hits / (info.dmgRange - beeStats.heal);
      } else {
        attackRange = 1;
        enemyTTK = info.hits / (beeStats.dmgClose + beeStats.dmgRange - info.heal);
        myTTK = beeStats.hits / (info.dmgClose + info.dmgRange - beeStats.heal);
      }
      loosingBattle = (enemyTTK < 0 || enemyTTK > myTTK) && myTTK !== Infinity;
      if (loosingBattle && info.dmgRange > beeStats.heal)
        targetedRange = 5;
      if (!info.heal && target.owner.username === "Awaii")
        loosingBattle = false; // not optimal code
      // loosingBattle = false; // the guy fucking crashed
    }
    /* else if (target instanceof StructureTower) {
      targetedRange = 20;
      loosingBattle = target.store.getUsedCapacity(RESOURCE_ENERGY) > bee.hitsMax / (TOWER_POWER_ATTACK * towerCoef(target, bee)) * 10 / 2; // / 2 just beacause
      if (!loosingBattle)
        targetedRange = 3;
    } */

    if (!loosingBattle && (bee.hits > bee.hitsMax * 0.5 || !beeStats.heal))
      targetedRange -= 2;

    if (this.holdPosition || !target)
      return OK;

    if (rangeToTarget < targetedRange)
      bee.flee(loosingBattle ? this.hive : this.order, opts);
    else if ((rangeToTarget > targetedRange && bee.hits > bee.hitsMax * 0.9) || (rangeToTarget > attackRange && !loosingBattle))
      bee.goTo(target, opts);
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
          if (enemy) {
            enemy = Apiary.intel.getEnemy(pos);
            this.beeAct(bee, enemy);
          } else {
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
