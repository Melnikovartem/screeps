import { SwarmMaster } from "../_SwarmMaster";

// import { towerCoef } from "../../abstract/utils";
import { setups } from "../../bees/creepsetups";
import { beeStates, enemyTypes, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { FlagOrder } from "../../order";
import type { CreepBattleInfo } from "../../abstract/intelligence";
import type { Boosts } from "../_Master";

const BOOST_LVL = 2;

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster {
  // failsafe
  movePriority = <3 | 4>4;
  setup = setups.knight.copy();
  notify = false;

  constructor(order: FlagOrder) {
    super(order);
    if (!this.order.memory.extraInfo)
      this.order.memory.extraInfo = { targetBeeCount: 1, maxSpawns: 1 };
    this.init();
  }

  get targetBeeCount(): number {
    return this.order && this.order.memory.extraInfo && this.order.memory.extraInfo.targetBeeCount;
  }

  set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo.targetBeeCount = value;
  }

  get maxSpawns(): number {
    let maxSpawns = this.order && this.order.memory.extraInfo && this.order.memory.extraInfo.maxSpawns;
    return maxSpawns === null ? Infinity : maxSpawns;
  }

  set maxSpawns(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo.maxSpawns = value;
  }

  get boosts() {
    return <Boosts | undefined>(this.order && this.order.memory.extraInfo && this.order.memory.extraInfo.boosts);
  }

  set boosts(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo.boosts = value;
  }

  get maxPath(): number {
    return this.order.memory.extraInfo && this.order.memory.extraInfo.maxPath || 0;
  }

  set maxPath(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo.maxPath = value;
  }

  init() {
    if (this.order.ref.includes("boost"))
      this.boosts = [{ type: "rangedAttack", lvl: BOOST_LVL }, { type: "attack", lvl: BOOST_LVL }
        , { type: "heal", lvl: BOOST_LVL }, { type: "fatigue", lvl: BOOST_LVL }, { type: "damage", lvl: BOOST_LVL },
      { type: "dismantle", lvl: 2 }, { type: "dismantle", lvl: 1 }, { type: "dismantle", lvl: 0 }];
    if (this.order.ref.includes("harass")) {
      this.maxSpawns = 8; // ~ 10H of non stop low lvl harass max ~ 10K energy
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.order.ref.includes("dismantle"))
      this.setup = setups.dismantler.copy();
    else if (this.order.ref.includes("polar")) {
      this.boosts = [{ type: "attack", lvl: 2 }
        , { type: "heal", lvl: BOOST_LVL }, { type: "damage", lvl: 2 }];
      this.setup.patternLimit = 10;
      this.setup.pattern = [ATTACK];
      this.setup.fixed = [TOUGH, TOUGH, TOUGH].concat(Array(12).fill(HEAL));
      this.maxSpawns = 100;
    } else if (this.order.ref.includes("6g3y")) {
      this.targetBeeCount = 2;
      this.maxSpawns = 100;
      this.setup.patternLimit = 30;
      this.setup.fixed = [TOUGH, TOUGH, TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
    }
    else if (this.boosts && !this.order.ref.includes("full")) {
      this.setup.patternLimit = 15;
      this.setup.fixed = [TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL];
    }
    if (this.order.ref.includes("keep"))
      this.maxSpawns = 30;
    if (!this.maxPath)
      this.maxPath = this.hive.pos.getTimeForPath(this);
  }

  get emergency() {
    return this.hive.state !== hiveStates.battle || this.pos.roomName === this.hive.roomName
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    if (this.checkBees(this.emergency, CREEP_LIFE_TIME - this.maxPath - 10)
      && (Game.time >= roomInfo.safeModeEndTime - 200 + this.hive.pos.getRoomRangeTo(this.pos) * 50)) {
      this.wish({
        setup: this.setup,
        priority: 4,
      });
    }
  }

  getStats(roomName?: string) {
    let myStats: CreepBattleInfo = {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    };

    _.forEach(this.activeBees, b => {
      if (roomName && b.pos.roomName !== roomName && (b.pos.enteranceToRoom && b.pos.enteranceToRoom.roomName !== roomName))
        return;
      let stats = Apiary.intel.getStats(b.creep);
      for (let i in stats.current)
        myStats[<keyof CreepBattleInfo>i] += stats.current[<keyof CreepBattleInfo>i];
    });
    return myStats;
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep | undefined) {
    let action1;
    let action2;

    let opt: TravelToOptions = {};
    if (target)
      opt.movingTarget = true;
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
      let healingTarget: Creep | Bee | PowerCreep | null = bee.hits < bee.hitsMax || (rangeToTarget <= 3 && beeStats.resist && !this.activeBees.filter(b => b.hits < b.hitsMax).length) ? bee : null;
      if (!healingTarget)
        healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));
      if (!healingTarget && roomInfo.dangerlvlmax > 3)
        healingTarget = bee;
      let rangeToHealingTarget = healingTarget ? bee.pos.getRangeTo(healingTarget) : Infinity;
      if (rangeToHealingTarget <= 1 && (!action1 || beeStats.heal > beeStats.dism + beeStats.dmgClose)) {
        action1 = () => bee.heal(healingTarget!)
      } else if (rangeToHealingTarget <= 3 && beeStats.heal > beeStats.dmgRange && !action1 && !action2)
        action2 = () => bee.rangedHeal(healingTarget!);
    }

    if (action1)
      action1();
    if (action2)
      action2();

    let targetedRange = 1;
    let loosingBattle = 1;
    let attackRange = 2;
    if (target instanceof Creep) {
      let enemyInfo = Apiary.intel.getComplexStats(target).current;
      loosingBattle = this.loosingBattle(enemyInfo, bee.pos.roomName);

      if (beeStats.dmgClose) {
        attackRange = 2;
      } else if (beeStats.dmgRange) {
        if (enemyInfo.dmgClose)
          attackRange = loosingBattle > 0 && enemyInfo.dmgClose > beeStats.heal ? 5 : 3;
        else if (enemyInfo.dmgRange)
          attackRange = 4;
        else
          attackRange = 2;
      } else
        attackRange = 4;

      if (loosingBattle < 0)
        if (enemyInfo.dmgRange > beeStats.heal)
          targetedRange = 5;
        else
          targetedRange = 3;
      else
        targetedRange = attackRange;
    }

    if (loosingBattle >= 0 && (bee.hits > bee.hitsMax * 0.3 || !beeStats.heal))
      targetedRange -= 2;
    else if (loosingBattle < 0)
      targetedRange = Infinity;

    if (!target)
      return OK;

    let shouldFlee = rangeToTarget < targetedRange;
    if (!shouldFlee && loosingBattle) {
      let enterance = bee.pos.enteranceToRoom;
      shouldFlee = !!enterance && enterance.roomName === target.pos.roomName;
    }
    let hiveTowers = Apiary.hives[bee.pos.roomName] && Object.keys(Apiary.hives[bee.pos.roomName].cells.defense.towers).length;
    if (shouldFlee && (!hiveTowers || bee.hits < bee.hitsMax)) {
      bee.flee(this.pos, opt, true); // loosingBattle && bee.pos.getRoomRangeTo(this.hive) <= 2 ? this.hive :
      return ERR_BUSY;
    }
    if (loosingBattle <= 0 && bee.pos.roomName === this.pos.roomName) {
      let newEnemy = bee.pos.findClosest(roomInfo.enemies.filter(e => {
        if (!(e.object instanceof Creep))
          return false;
        let stats = Apiary.intel.getStats(e.object).max;
        return this.loosingBattle(stats, bee.pos.roomName) > 0;
      }).map(e => e.object));
      if (newEnemy) {
        bee.goTo(newEnemy, bee.getFleeOpt(opt));
        return OK;
      }
    }
    if (rangeToTarget > targetedRange && bee.hits > bee.hitsMax * 0.75) {
      opt.movingTarget = true;
      bee.goTo(bee.pos.enteranceToRoom && rangeToTarget <= 1 && target.pos.getOpenPositions(false)[0] || target, opt);
      if (bee.targetPosition && bee.targetPosition.enteranceToRoom && bee.pos.roomName === this.pos.roomName)
        bee.targetPosition = bee.pos;
    }
    // if (bee.targetPosition && this.hive.roomName === bee.pos.roomName)
    // return ERR_BUSY; // help with deff i guess
    return OK;
  }

  loosingBattle(enemyInfo: CreepBattleInfo, roomName?: string, myInfo = this.getStats(roomName)) {
    let enemyTTK;
    let myTTK;
    myTTK = enemyInfo.hits / (myInfo.dmgClose + myInfo.dmgRange - Math.min(enemyInfo.resist, enemyInfo.heal * 0.7 / 0.3) - enemyInfo.heal);

    if (myInfo.dmgRange && !enemyInfo.dmgRange)
      enemyTTK = Infinity;
    else {
      let enemyDmg = enemyInfo.dmgRange + (myInfo.dmgRange && !myInfo.dmgClose ? 0 : enemyInfo.dmgClose)
      enemyTTK = myInfo.hits / (enemyDmg - Math.min(myInfo.resist, myInfo.heal * 0.7 / 0.3) - myInfo.heal);
    }

    if (enemyTTK < 0)
      enemyTTK = Infinity;
    if (myTTK < 0)
      myTTK = Infinity;
    if (enemyTTK === Infinity)
      return myTTK === Infinity ? 0 : 1; // draw
    if (enemyTTK < myTTK)
      return -1; // i am losing
    return 1; // i am wining
  }


  run() {
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting && (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK))
        bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      let enemy;
      if (bee.boosted && bee.ticksToLive < this.pos.getRoomRangeTo(this.hive) * 50 + 25
        && this.hive.cells.lab
        && this.hive.cells.lab.getUnboostLab(bee.ticksToLive))
        bee.state = beeStates.fflush;
      switch (bee.state) {
        case beeStates.work:
          let pos = bee.pos;
          if (bee.pos.roomName !== this.pos.roomName && bee.pos.getRoomRangeTo(this.pos) <= 1)
            pos = this.pos;
          let beeStats = Apiary.intel.getStats(bee.creep).current;
          if (beeStats.dism) {
            let room = Game.rooms[this.pos.roomName];
            if (room)
              enemy = _.compact(room.find(FIND_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED)
                .map(f => f.pos.lookFor(LOOK_STRUCTURES)[0]))[0];
            if (!enemy)
              enemy = Apiary.intel.getEnemyStructure(pos, 50);
          } else
            enemy = Apiary.intel.getEnemy(pos, bee.pos.x <= 3 || bee.pos.x >= 47 || bee.pos.y <= 3 || bee.pos.y >= 47 ? 0 : 10);

          if (!enemy) {
            let healingTarget = this.activeBees.filter(b => b.hits < b.hitsMax && b.pos.getRangeTo(bee) <= 2)[0];
            if (healingTarget && bee.getActiveBodyParts(HEAL))
              bee.heal(healingTarget);
            bee.goRest(this.pos);
          } else
            this.beeAct(bee, enemy);
          break;
        case beeStates.fflush:
          if (!this.hive.cells.lab || !bee.boosted) {
            bee.state = beeStates.work;
            break;
          }
          let lab = this.hive.cells.lab.getUnboostLab(bee.ticksToLive) || this.hive.cells.lab;
          bee.goTo(lab.pos, { range: 1 });
          if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
            bee.heal(bee);
          this.checkFlee(bee);
          break;
        case beeStates.chill:
          enemy = Apiary.intel.getEnemy(bee.pos, 20);
          let ans: number = OK;
          if (enemy) {
            enemy = Apiary.intel.getEnemy(bee.pos, 20);
            if (enemy && bee.pos.getRangeTo(enemy) > 3)
              enemy = undefined;
          }
          ans = this.beeAct(bee, enemy);
          if (bee.pos.roomName === this.pos.roomName)
            bee.state = beeStates.work;
          if (ans === OK) {
            let opt = this.hive.opt;
            opt.useFindRoute = true;
            bee.goTo(this.pos, opt);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          }
      }
    });
  }
}
