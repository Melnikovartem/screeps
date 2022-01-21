import { SwarmMaster } from "../_SwarmMaster";

import { beeStates, hiveStates, roomStates, enemyTypes } from "../../enums";
import { BOOST_MINERAL, BOOST_PARTS } from "../../cells/stage1/laboratoryCell";
import { SQUAD_VISUALS } from "../../settings";

import { profile } from "../../profiler/decorator";

import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { CreepSetup } from "../../bees/creepSetups";
import type { FlagOrder } from "../../order";
import type { CreepAllBattleInfo, CreepBattleInfo, Enemy } from "../../abstract/intelligence";

export type FormationPositions = [Pos, CreepSetup][];

//first tandem btw
@profile
export abstract class SquadMaster extends SwarmMaster {
  abstract boosts: Boosts;
  abstract formation: FormationPositions;
  readonly formationBees: (Bee | undefined)[] = [];

  constructor(order: FlagOrder) {
    super(order);
    let extraPos = this.order.flag.memory.extraPos;
    if (!extraPos || !("x" in extraPos) || !("y" in extraPos) || !("roomName" in extraPos))
      this.order.flag.memory.extraPos = (this.hive.state >= hiveStates.battle ? this.hive.pos : this.hive.rest);
    if (![TOP, BOTTOM, LEFT, RIGHT].includes(this.formationRotation))
      this.formationRotation = TOP;
  }

  get formationCenter() {
    let pos = this.order.flag.memory.extraPos!;
    return new RoomPosition(pos.x, pos.y, pos.roomName);
  }

  set formationCenter(value) {
    this.order.flag.memory.extraPos = value;
  }

  get formationRotation() {
    return <TOP | BOTTOM | LEFT | RIGHT>this.order.flag.memory.extraInfo;
  }

  set formationRotation(value: TOP | BOTTOM | LEFT | RIGHT) {
    this.order.flag.memory.extraInfo = value;
  }

  movePriority = <1>1;
  priority = <1>1;
  stuckValue = 0;

  stats: CreepAllBattleInfo = {
    max: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    }, current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    }
  };

  get maxSpawns() {
    return this.formation.length;
  }

  set maxSpawns(_) { }

  get targetBeeCount() {
    return this.formation.length;
  }

  set targetBeeCount(_) { }

  newBee(bee: Bee) {
    super.newBee(bee);
    for (let i = 0; i < this.formation.length; ++i)
      if (!this.formationBees[i] && bee.ref.includes(this.formation[i][1].name)) {
        this.formationBees[i] = bee;
        break;
      }
    if (this.spawned < Object.keys(this.bees).length)
      this.spawned = Object.keys(this.bees).length;
  }

  update() {
    super.update();

    this.stats = {
      max: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }
    };

    _.forEach(this.activeBees, b => {
      if (b.ticksToLive < 5)
        return;
      let stats = Apiary.intel.getStats(b.creep);
      for (let i in stats.max) {
        this.stats.max[<keyof CreepBattleInfo>i] += stats.max[<keyof CreepBattleInfo>i];
        this.stats.current[<keyof CreepBattleInfo>i] += stats.current[<keyof CreepBattleInfo>i]
      }
    });
    if (this.checkBees(this.emergency) && this.checkup) {
      for (let i = 0; i < this.formation.length; ++i) {
        if (!this.formationBees[i])
          this.wish({
            setup: this.formation[i][1],
            priority: this.priority,
          }, this.ref + "_" + i);
      }
    } else if (_.some(this.bees, b => b.state === beeStates.boosting)) {
      this.checkup;
    }

    for (let i = 0; i < this.formationBees.length; ++i) {
      let bee = this.formationBees[i];
      if (bee && !Object.keys(this.bees).includes(bee.ref))
        this.formationBees[i] = undefined;
    }
  }

  get checkup() {
    return true;
  }

  checkMinerals(body: BodyPartConstant[], coef = this.formation.length) {
    if (!this.hive.cells.storage || (this.hive.cells.lab && !Object.keys(this.hive.cells.lab.laboratories).length && this.boosts.length))
      return false;
    let ans = true
    for (let i = 0; i < this.boosts.length; ++i) {
      let b = this.boosts[i];
      let res = BOOST_MINERAL[b.type][b.lvl];
      let amountNeeded = LAB_BOOST_MINERAL * _.sum(body, bb => bb === BOOST_PARTS[b.type] ? 1 : 0) * coef;
      if (amountNeeded && this.hive.cells.storage.getUsedCapacity(res) < amountNeeded) {
        this.hive.add(this.hive.mastersResTarget, res, amountNeeded);
        ans = false;
      }
    }
    return ans;
  }

  get emergency() {
    return !!this.beesAmount || (this.hive.state !== hiveStates.battle && this.hive.state !== hiveStates.lowenergy);
  }

  getDeisredPos(i: number, centerPos: RoomPosition = this.formationCenter) {
    let p = this.formation[i][0];
    let [x, y] = [centerPos.x, centerPos.y];
    switch (this.formationRotation) {
      case TOP:
        x += p.x;
        y += p.y;
        break;
      case BOTTOM:
        x -= p.x;
        y -= p.y;
        break;
      case LEFT:
        y -= p.x;
        x += p.y;
        break;
      case RIGHT:
        y += p.x;
        x -= p.y;
        break;
    }
    if (x < 0 || y < 0 || x > 49 || y > 49)
      return null;
    return new RoomPosition(x, y, centerPos.roomName);
  }

  validFormation() {
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let beePos = bee.pos;
      let desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !beePos.equal(desiredPos))
        return ERR_NOT_IN_RANGE;
    }

    return OK;
  }

  getSquadMoveMentValue(pos: RoomPosition, centerRef: string, ignoreEnemyCreeps = true) {
    let sum = 0;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos || terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_WALL)
        if (bee.ref === centerRef)
          return 255;
        else
          sum += 30;
      else if (desiredPos.enteranceToRoom)
        sum += 20;
      else if (!desiredPos.isFree(true))
        if (bee.ref === centerRef)
          return 255;
        else
          sum += 30;
      else if (!ignoreEnemyCreeps && desiredPos.lookFor(LOOK_CREEPS).filter(c => !c.my).length)
        sum += 20;
      else if (terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP
        && !(desiredPos.roomName in Game.rooms && desiredPos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length))
        sum += 5;
      else
        sum += 1;
    }
    return Math.ceil(sum / this.activeBees.length);
  }

  beeAct(bee: Bee, target: Creep | PowerCreep | Structure | undefined | null, healingTargets: { bee: Bee, heal: number }[]) {
    let action1;
    let action2;

    let beeStats = Apiary.intel.getStats(bee.creep).current;

    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);
    let healingTarget: { bee: Bee | Creep | null, heal: number } = { bee: null, heal: 0 };

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    if (beeStats.dmgRange > 0) {
      if (rangeToTarget <= 3 && !(target instanceof Structure))
        action2 = () => bee.rangedAttack(target!);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.object.pos.getRangeTo(bee) <= 3);
        let tempNoRamp = tempTargets.filter(e => !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length);
        if (tempNoRamp.length)
          tempTargets = tempNoRamp;
        else if (rangeToTarget <= 3) {
          tempTargets = [];
          action2 = () => bee.rangedAttack(target!);
        }
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
      if (healingTargets.length)
        healingTarget = healingTargets.reduce((prev, curr) => {
          let ans = (curr.bee.pos.getRangeTo(bee) || 1) - (prev.bee.pos.getRangeTo(bee) || 1);
          if (ans === 0)
            ans = prev.heal - curr.heal;
          return ans < 0 ? curr : prev;
        });
      if (!healingTarget.bee)
        healingTarget.bee = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

      if (!healingTarget.bee && !action1 && roomInfo.dangerlvlmax > 3)
        healingTarget.bee = bee;

      let rangeToHealingTarget = healingTarget.bee ? bee.pos.getRangeTo(healingTarget.bee) : Infinity;
      if (rangeToHealingTarget <= 1 && (!action1 || beeStats.heal > beeStats.dism + beeStats.dmgClose)) {
        action1 = () => {
          healingTarget.heal = Math.max(0.1, healingTarget.heal - beeStats.heal);
          let ans = bee.heal(healingTarget.bee!);
          return ans;
        }
      } else if (rangeToHealingTarget <= 3 && beeStats.heal > beeStats.dmgRange)
        action2 = () => bee.rangedHeal(healingTarget.bee!);
    }

    if (action1)
      action1();

    if (action2)
      action2();

    return OK;
  }

  get desiredPoss() {
    let ans = []
    for (let i = 0; i < this.formationBees.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i);
      if (desiredPos)
        ans.push({ pos: desiredPos });
    }
    return ans;
  }

  getPathArgs(centerBeeRef: string): TravelToOptions {
    return {
      useFindRoute: true,
      maxOps: 5000,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        if (!(roomName in Game.rooms))
          return undefined;
        let roomInfo = Apiary.intel.getInfo(roomName, Infinity);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y) {
            let moveMent = this.getSquadMoveMentValue(new RoomPosition(x, y, roomName), centerBeeRef);
            if (moveMent > 5 && roomInfo.roomState === roomStates.ownedByEnemy)
              matrix.set(x, y, Math.min(moveMent * 2, 255));
            else
              matrix.set(x, y, moveMent);
          }
        return matrix;
      }
    }
  }

  moveCenter(bee: Bee, enemy: Creep | Structure | PowerCreep | undefined | null) {
    let moveTarget = this.pos;
    let opt = this.getPathArgs(bee.ref);
    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 10);
    let fatigue = 0;

    if (roomInfo.roomState === roomStates.ownedByEnemy || roomInfo.dangerlvlmax >= 8) {
      _.forEach(this.activeBees, b => {
        fatigue += b.creep.fatigue;
      });
      if (fatigue) {
        bee.stop();
        return;
      }
    }

    let busy = false;
    let notNearExit = (bee.pos.x > 2 && bee.pos.x < 47 && bee.pos.y > 2 && bee.pos.y < 47);
    if (enemy && bee.pos.roomName === this.pos.roomName) {
      moveTarget = enemy.pos;
      opt.movingTarget = true;
      if (notNearExit && bee.pos.getRangeTo(enemy) < 10) {
        let rotate = this.checkRotation(bee.pos.getDirectionTo(enemy));
        if (rotate) {
          bee.memory._trav.path = undefined;
          busy = this.rotate(rotate);
        }
      }
    }

    if (!busy) {
      bee.goTo(moveTarget, opt);
      if (!bee.targetPosition && bee.pos.getRangeTo(this) === 1)
        bee.goTo(this.pos);

      if (moveTarget.getRangeTo(bee) <= 3 && (!bee.targetPosition || bee.targetPosition.equal(bee.pos)) && this.getSquadMoveMentValue(bee.pos, bee.ref, false) > 5) {
        let poss = bee.pos.getOpenPositions(true);
        if (poss.length) {
          let newPos = poss.reduce((prev, curr) => {
            let ans = curr.getRangeTo(moveTarget) - prev.getRangeTo(moveTarget);
            if (ans === 0)
              ans = this.getSquadMoveMentValue(curr, bee.ref, false) - this.getSquadMoveMentValue(prev, bee.ref, false);
            return ans < 0 ? curr : prev;
          });
          if (!newPos.equal(bee.pos))
            bee.goTo(newPos, opt);
        }
      }

      if (!roomInfo.safePlace && this.stats.current.heal) {
        if (this.canBeOutDmged(bee.pos)) {
          opt = bee.getFleeOpt(opt);
          let exit = bee.pos.findClosest(Game.rooms[bee.pos.roomName].find(FIND_EXIT));
          bee.goTo(exit || this.pos, opt);
        } else if (bee.targetPosition && this.canBeOutDmged(bee.targetPosition))
          bee.stop();
        else if (roomInfo.roomState === roomStates.ownedByEnemy && notNearExit) {
          let formationBreak = bee.targetPosition && this.getSquadMoveMentValue(bee.targetPosition, bee.ref, false) > 5;
          if (formationBreak)
            bee.stop();
        }
      }


      this.formationCenter = (bee.targetPosition && bee.targetPosition.isFree(true) ? bee.targetPosition : bee.pos);
    } else
      bee.goTo(this.formationCenter);
  }

  /* getSquadDist(pos: RoomPosition) {
    let sum = 0;
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos) {
        sum += Infinity;
        continue;
      }
      sum += desiredPos.getRangeTo(pos);
    }
    return sum;
  } */

  canValidate() {
    let terrain = Game.map.getRoomTerrain(this.formationCenter.roomName);
    let poss = this.desiredPoss;
    for (let i = 0; i < poss.length; ++i) {
      let desiredPos = poss[i].pos;
      if (!desiredPos.isFree(true) || desiredPos.enteranceToRoom || terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
        return ERR_NO_PATH;
    }
    return OK;
  }

  canBeOutDmged(pos: RoomPosition) {
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos)
        continue;
      let roomInfo = Apiary.intel.getInfo(pos.roomName);
      let stats;
      if (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral)
        stats = Apiary.intel.getComplexStats(desiredPos).current
      else
        stats = Apiary.intel.getComplexStats(desiredPos).current; // , 3, 1
      let creepDmg = stats.dmgClose + stats.dmgRange;
      let towerDmg = Apiary.intel.getTowerAttack(desiredPos);
      let beeStats = Apiary.intel.getStats(bee.creep);
      let myStats = Apiary.intel.getComplexMyStats(desiredPos).current;
      let heal = Math.max(myStats.heal * 0.75, this.stats.current.heal); // 0.75 cause won't heal somtimes in a brawl
      if (towerDmg + creepDmg > heal + Math.min(beeStats.current.resist, heal * 0.7 / 0.3))
        return true;
    }
    return false;
  }

  run() {
    let enemy: Enemy["object"] | undefined;
    let roomInfo = Apiary.intel.getInfo(this.formationCenter.roomName, 10);
    if (roomInfo.roomState === roomStates.ownedByEnemy)
      roomInfo = Apiary.intel.getInfo(this.formationCenter.roomName, 4);
    if (this.stats.current.dmgClose + this.stats.current.dmgRange > 0) {
      let enemies = roomInfo.enemies.filter(e => e.dangerlvl === roomInfo.dangerlvlmax
        || (e.dangerlvl >= 4 && this.formationCenter.getRangeTo(e.object) <= 5
          && !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length));
      if (enemies.length)
        enemy = enemies.reduce((prev, curr) => {
          let ans = this.formationCenter.getRangeTo(curr.object) - this.formationCenter.getRangeTo(prev.object);
          if (ans === 0)
            ans = prev.dangerlvl - curr.dangerlvl;
          return ans < 0 ? curr : prev;
        }).object;
    } else if (this.stats.current.dism > 0)
      enemy = Apiary.intel.getEnemyStructure(this.formationCenter, 50);

    let healingTargets: { bee: Bee, heal: number }[] = [];
    if (this.stats.current.heal)
      healingTargets = this.activeBees.filter(b => b.hits < b.hitsMax).map(b => { return { bee: b, heal: b.hitsMax - b.hits } });

    _.forEach(this.activeBees, bee => {
      this.beeAct(bee, enemy, healingTargets);
    });

    let readyToGo = this.beesAmount >= this.maxSpawns;
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting) {
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, this.boosts) === OK)
          bee.state = beeStates.chill;
        else
          readyToGo = false;
      }
    });
    if (!readyToGo) {
      _.forEach(this.activeBees, bee => {
        if (bee.state !== beeStates.boosting)
          bee.goRest(this.formationCenter);
      });
      return;
    }

    let centerBee = _.compact(this.formationBees)[0];
    if (!centerBee)
      return;

    let valid: number = this.validFormation();

    if (this.stuckValue > 0 && valid === OK)
      centerBee.memory._trav.path = undefined;

    if (valid === OK || this.canValidate() !== OK || this.stuckValue > 6) {
      this.stuckValue = 0;
      this.moveCenter(centerBee, enemy);
    } else
      this.stuckValue += 1;

    let desired = this.desiredPoss;
    for (let i = 0; i < this.formationBees.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !desiredPos.isFree(true)) {
        if (centerBee.targetPosition && !centerBee.targetPosition.equal(centerBee.pos))
          bee.goTo(centerBee, { obstacles: desired });
        else
          bee.goRest(centerBee.pos);
      } else if (bee.pos.isNearTo(desiredPos)) {
        if (valid === OK || !bee.pos.equal(desiredPos))
          bee.targetPosition = desiredPos;
      } else
        bee.goTo(desiredPos);
    }

    if (SQUAD_VISUALS)
      for (let i = 0; i < this.formationBees.length; ++i) {
        let bee = this.formationBees[i];
        if (!bee)
          continue;
        let desiredPos = this.getDeisredPos(i);
        if (!desiredPos)
          continue;
        let vis = Apiary.visuals;
        if (vis.caching[desiredPos.roomName] && Game.time > vis.caching[desiredPos.roomName].lastRecalc)
          continue;
        let style: CircleStyle = {};
        if (this.formationBees[i] && bee.ref === centerBee.ref)
          style.fill = "#FF0000";
        new RoomVisual(desiredPos.roomName).circle(desiredPos.x, desiredPos.y, style);
      }
  }

  checkRotation(direction: DirectionConstant) {
    let ans: -1 | 0 | 1 = 0;
    // -1 - rotete left (not clockwise)
    // 1 - rotate right (clockwise)
    switch (direction) {
      case TOP:
        switch (this.formationRotation) {
          case BOTTOM:
          case RIGHT:
            ans = -1;
            break;
          case LEFT:
            ans = 1;
            break;
          case TOP:
        }
        break;
      case TOP_RIGHT:
        switch (this.formationRotation) {
          case BOTTOM:
            ans = -1;
            break;
          case LEFT:
            ans = 1;
            break;
          case RIGHT:
          case TOP:
        }
        break;
      case RIGHT:
        switch (this.formationRotation) {
          case BOTTOM:
          case LEFT:
            ans = -1;
            break;
          case TOP:
            ans = 1;
            break;
          case RIGHT:
        }
        break;
      case BOTTOM_RIGHT:
        switch (this.formationRotation) {
          case LEFT:
            ans = -1;
            break;
          case TOP:
            ans = 1;
            break;
          case RIGHT:
          case BOTTOM:
        }
        break;
      case BOTTOM:
        switch (this.formationRotation) {
          case TOP:
          case RIGHT:
            ans = 1;
            break;
          case LEFT:
            ans = -1;
          case BOTTOM:
        }
        break;
      case BOTTOM_LEFT:
        switch (this.formationRotation) {
          case RIGHT:
            ans = 1;
            break;
          case TOP:
            ans = -1;
            break;
          case LEFT:
          case BOTTOM:
        }
        break;
      case LEFT:
        switch (this.formationRotation) {
          case BOTTOM:
          case RIGHT:
            ans = 1;
            break;
          case TOP:
            ans = -1;
            break;
          case LEFT:
        }
        break;
      case TOP_LEFT:
        switch (this.formationRotation) {
          case BOTTOM:
            ans = 1;
            break;
          case RIGHT:
            ans = -1;
            break;
          case LEFT:
          case TOP:
        }
        break;
    }
    return ans;
  }

  rotate(direction: -1 | 1) {
    switch (this.formationRotation) {
      case TOP:
        switch (direction) {
          case -1:
            this.formationRotation = LEFT;
            break;
          case 1:
            this.formationRotation = RIGHT;
            break;
        }
        break;
      case BOTTOM:
        switch (direction) {
          case -1:
            this.formationRotation = RIGHT;
            break;
          case 1:
            this.formationRotation = LEFT;
            break;
        }
        break;
      case LEFT:
        switch (direction) {
          case -1:
            this.formationRotation = BOTTOM;
            break;
          case 1:
            this.formationRotation = TOP;
            break;
        }
        break;
      case RIGHT:
        switch (direction) {
          case -1:
            this.formationRotation = TOP;
            break;
          case 1:
            this.formationRotation = BOTTOM;
            break;
        }
        break;
    }
    let possibleCenters = this.formationCenter.getPositionsInRange(1);
    let calcErrors = (newCenter: RoomPosition) => {
      let sum = 0;
      for (let i = 0; i < this.formationBees.length; ++i) {
        let bee = this.formationBees[i];
        if (!bee)
          continue;
        let desiredPos = this.getDeisredPos(i, newCenter);
        if (!desiredPos || !desiredPos.isNearTo(bee))
          ++sum;
      }
      return sum;
    }
    let newCenter = this.formationCenter;
    let errors = calcErrors(newCenter);

    for (let i = 0; i < possibleCenters.length; ++i) {
      let pos = possibleCenters[i];
      let newError = calcErrors(pos);
      if (newError < errors) {
        newCenter = pos;
        errors = newError;
      }
    }
    if (!this.formationCenter.equal(newCenter)) {
      this.formationCenter = newCenter;
      return true;
    }
    return false;
  }
}
