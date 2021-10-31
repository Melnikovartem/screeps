import { SwarmMaster } from "../_SwarmMaster";

import { beeStates, hiveStates, roomStates, enemyTypes } from "../../enums";
import { BOOST_MINERAL, BOOST_PARTS } from "../../cells/stage1/laboratoryCell";
// import { PEACE_PACKS, NON_AGRESSION_PACKS } from "../../abstract/intelligence";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { CreepSetup } from "../../bees/creepSetups";
import type { Order } from "../../order";
import type { CreepAllBattleInfo, CreepBattleInfo, Enemy } from "../../abstract/intelligence";

export type FormationPositions = [Pos, CreepSetup][];
// export type SquareFormationPositions = [[{ x: 0 | 1, y: 0 | 1 }, CreepSetup], [{ x: 0 | 1, y: 0 | 1 }, CreepSetup], [{ x: 0 | 1, y: 0 | 1 }, CreepSetup], [{ x: 0 | 1, y: 0 | 1 }, CreepSetup]];
const SQUAD_VISUALS = true;

//first tandem btw
@profile
export abstract class SquadMaster extends SwarmMaster {
  abstract boosts: Boosts;
  abstract formation: FormationPositions;
  formationBees: (Bee | undefined)[] = [];

  constructor(order: Order) {
    super(order);
    let extraPos = this.order.flag.memory.extraPos;
    if (!extraPos || !("x" in extraPos) || !("y" in extraPos) || !("roomName" in extraPos))
      this.order.flag.memory.extraPos = (this.hive.state === hiveStates.battle ? this.hive.pos : this.hive.rest);
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

  movePriority = <2>2;
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
    if (!this.hive.cells.storage)
      return false;
    for (let i = 0; i < this.boosts.length; ++i) {
      let b = this.boosts[i];
      let res = BOOST_MINERAL[b.type][b.lvl];
      let amountNeeded = LAB_BOOST_MINERAL * _.sum(body, bb => bb === BOOST_PARTS[b.type] ? 1 : 0) * coef;
      if (amountNeeded && this.hive.cells.storage.getUsedCapacity(res) < amountNeeded) {
        this.hive.add(this.hive.mastersResTarget, res, amountNeeded);
        return false;
      }
    }
    return true;
  }

  get emergency() {
    return this.hive.state !== hiveStates.battle && this.hive.state !== hiveStates.lowenergy;
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
      else if (desiredPos.getEnteranceToRoom())
        sum += 20;
      else if (!desiredPos.isFree(true))
        if (bee.ref === centerRef)
          return 255;
        else
          sum += 30;
      else if (!ignoreEnemyCreeps && desiredPos.lookFor(LOOK_CREEPS).filter(c => !c.my).length)
        sum += 20;
      else if (terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
        sum += 5;
      else
        sum += 1;
    }
    /* let roomState = Apiary.intel.getInfo(pos.roomName).roomState;
    if (roomState === roomStates.ownedByEnemy || true) {
      sum += Math.floor(5 - new RoomPosition(25, 25, pos.roomName).getRoomRangeTo(pos) / 10)
    } */
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
        if (tempTargets.length) {
          let tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0)
              ans = bee.pos.getRangeTo(curr.object) - bee.pos.getRangeTo(prev.object);
            return ans < 0 ? curr : prev;
          });
          if (tempTarget)
            action2 = () => bee.rangedAttack(tempTarget.object);
        }
      }
    }

    if (beeStats.dism > 0) {
      if (beeStats.dism > 0 && rangeToTarget <= 1 && target instanceof Structure)
        action1 = () => bee.dismantle(target);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.type === enemyTypes.static && e.object.pos.getRangeTo(bee) <= 1);
        if (tempTargets.length)
          action1 = () => bee.attack(tempTargets[0].object);
      }
    } else if (beeStats.dmgClose > 0) {
      if (rangeToTarget <= 1)
        action1 = () => bee.attack(target);
      else {
        let tempTargets = roomInfo.enemies.filter(e => e.object.pos.getRangeTo(bee) <= 1);
        let tempNoRamp = tempTargets.filter(e => !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length);
        if (tempNoRamp.length)
          tempTargets = tempNoRamp;
        if (tempTargets.length) {
          let tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0)
              ans = bee.pos.getRangeTo(curr.object) - bee.pos.getRangeTo(prev.object);
            return ans < 0 ? curr : prev;
          });
          if (tempTarget)
            action1 = () => bee.attack(tempTarget.object);
        }
      }
    }

    if (beeStats.heal > 0) {
      let fromCore = healingTargets.filter(t => t.heal > 0);
      if (fromCore.length)
        healingTarget = fromCore.reduce((prev, curr) => {
          let ans = (curr.bee.pos.getRangeTo(bee) || 1) - (prev.bee.pos.getRangeTo(bee) || 1);
          if (ans === 0)
            ans = prev.heal - curr.heal;
          return ans < 0 ? curr : prev;
        });
      if (!healingTarget.bee)
        healingTarget.bee = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

      if (!healingTarget.bee && !action1)
        healingTarget.bee = bee;

      let rangeToHealingTarget = healingTarget.bee ? bee.pos.getRangeTo(healingTarget.bee) : Infinity;

      if (rangeToHealingTarget <= 1 && (!action1 || beeStats.heal > beeStats.dism + beeStats.dmgClose))
        action1 = () => {
          healingTarget.heal -= beeStats.heal;
          return bee.heal(healingTarget.bee);
        }
      else if (beeStats.heal > beeStats.dmgRange)
        action2 = () => bee.rangedHeal(healingTarget.bee);
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
    let moveTarget = this.order.pos;
    let opts = this.getPathArgs(bee.ref);
    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName);
    let fatigue = 0;

    if (roomInfo.roomState === roomStates.ownedByEnemy) {
      _.forEach(this.activeBees, b => {
        fatigue += b.creep.fatigue;
      });
      if (fatigue)
        return;
    }

    let busy = false;
    let notNearExit = (bee.pos.x > 2 && bee.pos.x < 47 && bee.pos.y > 2 && bee.pos.y < 47);
    if (enemy && bee.pos.roomName === this.order.pos.roomName) {
      moveTarget = enemy.pos;
      opts.movingTarget = true;
      // if (this.stats.current.dmgRange > this.stats.current.dmgClose + this.stats.current.dism)
      //  opts.range = 3;
      if (notNearExit) {
        let rotate = this.checkRotation(bee.pos.getDirectionTo(enemy));
        if (rotate)
          busy = this.rotate(rotate);
      }
    } /* else if (bee.pos.isNearTo(this.order)) {
      let direction = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT][Math.floor(Math.random() * 4)];
      let rotate = this.checkRotation(direction);
      if (rotate)
        busy = this.rotate(rotate);
      console .log(direction, this.formationRotation, rotate, busy);
    } testing rotation */

    if (!busy) {
      bee.goTo(moveTarget, opts);
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
            bee.goTo(newPos, opts);
        }
      }

      if (!roomInfo.safePlace && (this.canBeOutDmged(bee.pos) || (bee.targetPosition && this.canBeOutDmged(bee.targetPosition)))) {
        opts = bee.getFleeOpt(opts);
        let exit = bee.pos.findClosest(Game.rooms[bee.pos.roomName].find(FIND_EXIT));
        bee.goTo(exit || this.order, opts);
      }

      if (roomInfo.roomState === roomStates.ownedByEnemy) {
        let formationBreak = bee.targetPosition && notNearExit
          && this.getSquadMoveMentValue(bee.targetPosition, bee.ref, false) > 5;
        if (formationBreak)
          bee.targetPosition = undefined;
      }
    }

    if (!busy)
      this.formationCenter = (bee.targetPosition && bee.targetPosition.isFree(true) ? bee.targetPosition : bee.pos);
    else
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
      if (!desiredPos.isFree(true) || desiredPos.getEnteranceToRoom() || terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
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
      let stats = Apiary.intel.getComplexStats(desiredPos).current;
      let creepDmg = stats.dmgClose + stats.dmgRange;
      let towerDmg = Apiary.intel.getTowerAttack(desiredPos);
      let beeStats = Apiary.intel.getStats(bee.creep).current;
      let myStats = Apiary.intel.getComplexMyStats(desiredPos).current;
      let heal = Math.max(myStats.heal, this.stats.current.heal);
      let enemyPower = towerDmg + creepDmg;
      // + 10% for safety
      if (enemyPower * 1.1 > heal + Math.min(beeStats.resist, heal * 0.7 / 0.3))
        return true;
    }
    return false;
  }

  run() {
    let enemy: Enemy["object"] | undefined;
    let roomInfo = Apiary.intel.getInfo(this.formationCenter.roomName);
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
      enemy = Apiary.intel.getEnemyStructure(this.formationCenter);

    let healingTargets: { bee: Bee, heal: number }[] = [];
    if (this.stats.current.heal) {
      healingTargets = this.activeBees.filter(b => b.hits < b.hitsMax).map(b => { return { bee: b, heal: b.hitsMax - b.hits } });
    }

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
      if (!desiredPos || !desiredPos.isFree(true))
        bee.goTo(centerBee, { obstacles: desired });
      else
        bee.goTo(desiredPos) //, { obstacles: desiredPos.equal(bee.pos) ? undefined : desired });
    }

    if (SQUAD_VISUALS)
      for (let i = 0; i < this.formationBees.length; ++i) {
        let bee = this.formationBees[i];
        if (!bee)
          continue;
        let desiredPos = this.getDeisredPos(i);
        if (!desiredPos)
          continue;
        let style: CircleStyle = {};
        if (this.formationBees[i] && bee.ref === centerBee.ref)
          style.fill = "#FF0000";
        Apiary.visuals.changeAnchor(1, 1, desiredPos.roomName);
        Apiary.visuals.anchor.vis.circle(desiredPos.x, desiredPos.y, style);
        Apiary.visuals.exportAnchor();
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

  /*checkRotation(direction: DirectionConstant) {
    let ans: -1 | 0 | 1 = 0;
    // -1 - rotete left (not clockwise)
    // 1 - rotate right (clockwise)
    switch (direction) {
      case TOP:
        switch (this.formationRotation) {
          case BOTTOM:
          case RIGHT:
          case LEFT:
            ans = 1;
            break;
          case TOP:
        }
        break;
      case TOP_RIGHT:
        switch (this.formationRotation) {
          case BOTTOM:
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
          case TOP:
            ans = 1;
            break;
          case RIGHT:
        }
      case BOTTOM_RIGHT:
        switch (this.formationRotation) {
          case LEFT:
          case TOP:
            ans = 1;
            break;
          case RIGHT:
          case BOTTOM:
        }
      case BOTTOM: switch (this.formationRotation) {
        case LEFT:
        case RIGHT:
        case TOP:
          ans = 1;
          break;
        case BOTTOM:
      }
        break;
      case BOTTOM_LEFT:
        switch (this.formationRotation) {
          case RIGHT:
          case TOP:
            ans = 1;
            break;
          case LEFT:
          case BOTTOM:
        }
        break;
      case LEFT:
        switch (this.formationRotation) {
          case BOTTOM:
          case RIGHT:
          case TOP:
            ans = 1;
            break;
          case LEFT:
        }
        break;
      case TOP_LEFT:
        switch (this.formationRotation) {
          case BOTTOM:
          case RIGHT:
            ans = 1;
            break;
          case LEFT:
          case TOP:
        }
        break;
    }
    return ans;
  }*/

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

/* @profile
export abstract class SquareSquadMaster extends SquadMaster {
  abstract formation: SquareFormationPositions;

  rotate(direction: -1 | 1) { // TODO efficient rotation
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
            this.formationRotation = TOP;
            break;
          case 1:
            this.formationRotation = BOTTOM;
            break;
        }
        break;
      case RIGHT:
        switch (direction) {
          case -1:
            this.formationRotation = BOTTOM;
            break;
          case 1:
            this.formationRotation = TOP;
            break;
        }
        break;
    }
    return false;
  }
}*/
