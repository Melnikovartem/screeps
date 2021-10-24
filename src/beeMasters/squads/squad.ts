import { SwarmMaster } from "../_SwarmMaster";

import { beeStates, hiveStates, roomStates } from "../../enums";
import { BOOST_MINERAL, BOOST_PARTS } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { CreepSetup } from "../../bees/creepSetups";
import type { CreepAllBattleInfo, CreepBattleInfo, Enemy } from "../../abstract/intelligence";

export type FormationPositions = [Pos, CreepSetup][];
const SQUAD_VISUALS = true;

//first tandem btw
@profile
export abstract class SquadMaster extends SwarmMaster {
  abstract boosts: Boosts;
  abstract formation: FormationPositions;
  formationBees: (Bee | undefined)[] = [];

  formationCenter: RoomPosition = this.hive.state === hiveStates.battle ? this.hive.pos : this.hive.rest;
  formationRotation: TOP | BOTTOM | LEFT | RIGHT = TOP;

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
    }, current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
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
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
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

  checkMinerals(body: BodyPartConstant[]) {
    if (!this.hive.cells.storage)
      return false;
    for (let i = 0; i < this.boosts.length; ++i) {
      let b = this.boosts[i];
      let res = BOOST_MINERAL[b.type][b.lvl];
      let amountNeeded = LAB_BOOST_MINERAL * _.sum(body, bb => bb === BOOST_PARTS[b.type] ? 1 : 0) * this.formation.length;
      if (amountNeeded && this.hive.cells.storage.getUsedCapacity(res) < amountNeeded) {
        this.hive.add(this.hive.mastersResTarget, res, amountNeeded);
        return false;
      }
    }
    return true;
  }

  get emergency() {
    return false;
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

  getSquadMoveMentValue(pos: RoomPosition, centerRef: string) {
    let max = 1;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos)
        continue; // exit
      if (!desiredPos.isFree(true))
        if (bee.ref === centerRef)
          return 255;
        else
          max = 64
      if (terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
        max = Math.max(max, 5);
    }
    return max;
  }

  validateFormation() {
    let terrain = Game.map.getRoomTerrain(this.formationCenter.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      let desiredPos = this.getDeisredPos(i);
      if (this.formationBees[i] && (!desiredPos || !desiredPos.isFree(true) || terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP))
        return ERR_NO_PATH;
    }

    for (let i = 0; i < this.formationBees.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i)!;
      bee.goTo(desiredPos, { movingTarget: true, ignoreCreeps: false });
      bee.actionPosition = desiredPos;
    }
    return OK;
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep | undefined | null, healingTargets: { bee: Bee, heal: number }[]) {
    let action1;
    let action2;

    let beeStats = Apiary.intel.getStats(bee.creep).current;

    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);
    let healingTarget: { bee: Bee | Creep | null, heal: number } = { bee: null, heal: 0 };

    if (beeStats.heal > 0) {
      let fromCore = healingTargets.filter(t => t.heal > 0);
      if (fromCore.length)
        healingTarget = fromCore.reduce((prev, curr) => {
          let ans = curr.bee.pos.getRangeTo(bee) - prev.bee.pos.getRangeTo(bee);
          if (ans === 0)
            ans = prev.heal - curr.heal;
          return ans < 0 ? curr : prev;
        });
      if (!healingTarget.bee)
        healingTarget.bee = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));
    }

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    let rangeToHealingTarget = healingTarget.bee ? bee.pos.getRangeTo(healingTarget.bee) : Infinity;

    if (rangeToTarget <= 3 && beeStats.dmgRange > 0)
      action2 = () => bee.rangedAttack(target);
    else if (rangeToHealingTarget <= 3 && rangeToHealingTarget > 1 && beeStats.heal > 0 && healingTarget.heal > 0)
      action2 = () => {
        healingTarget.heal -= beeStats.heal / HEAL_POWER * RANGED_HEAL_POWER;
        return bee.rangedHeal(healingTarget.bee)
      }
    else if (roomInfo.roomState >= roomStates.reservedByEnemy && beeStats.dmgRange > 0
      && roomInfo.enemies.filter(e => bee.pos.getRangeTo(e.object) <= 3 && "owner" in e.object).length)
      action2 = () => bee.rangedMassAttack();
    else if (rangeToHealingTarget <= 3 && rangeToHealingTarget > 1 && beeStats.heal > 0)
      action2 = () => {
        healingTarget.heal -= beeStats.heal / HEAL_POWER * RANGED_HEAL_POWER;
        return bee.rangedHeal(healingTarget.bee)
      }

    if (rangeToHealingTarget <= 1 && beeStats.heal > 0 && healingTarget.heal > 0)
      action1 = () => {
        healingTarget.heal -= beeStats.heal;
        return bee.heal(healingTarget.bee);
      }
    else if (rangeToTarget === 1 && beeStats.dism > 0 && target instanceof Structure)
      action1 = () => bee.dismantle(target);
    else if (rangeToTarget === 1 && beeStats.dmgClose > 0)
      action1 = () => bee.attack(target);
    else if (rangeToHealingTarget <= 1 && beeStats.heal > 0)
      action1 = () => {
        healingTarget.heal -= beeStats.heal;
        return bee.heal(healingTarget.bee);
      }

    if (action1)
      action1();

    if (action2)
      action2();

    return OK;
  }

  rotateFormation(direction: DirectionConstant) {
    switch (direction) {
      case TOP:
        this.formationRotation = TOP;
        break;
      case TOP_RIGHT:
        if (this.formationRotation !== TOP)
          this.formationRotation = RIGHT;
        break;
      case RIGHT:
        this.formationRotation = RIGHT;
        break;
      case BOTTOM_RIGHT:
        if (this.formationRotation !== BOTTOM)
          this.formationRotation = RIGHT;
        break;
      case BOTTOM:
        this.formationRotation = BOTTOM;
        break;
      case BOTTOM_LEFT:
        if (this.formationRotation !== BOTTOM)
          this.formationRotation = LEFT;
        break;
      case LEFT:
        this.formationRotation = LEFT;
        break;
      case TOP_LEFT:
        if (this.formationRotation !== TOP)
          this.formationRotation = LEFT;
        break;
    }
  }

  getPathArgs(centerBeeRef: string): TravelToOptions {
    return {
      movingTarget: true,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        if (!(roomName in Game.rooms))
          return undefined;
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y) {
            let moveMent = this.getSquadMoveMentValue(new RoomPosition(x, y, roomName), centerBeeRef);
            matrix.set(x, y, moveMent);
          }
        return matrix;
      }
    }
  }

  moveCenter(bee: Bee, enemy: Creep | Structure | PowerCreep | undefined | null) {
    let moveTarget = this.order.pos;
    let opts = this.getPathArgs(bee.ref);
    if (enemy) {
      if (bee.pos.roomName === this.order.pos.roomName)
        moveTarget = enemy.pos;
      if (enemy instanceof Creep && this.stats.current.dmgRange > this.stats.current.dmgClose + this.stats.current.dism)
        opts.range = 2;
      if (enemy && (enemy instanceof Structure || bee.pos.getRangeTo(moveTarget) > 3)) {
        let prevRotation = this.rotateFormation;
        this.rotateFormation(bee.pos.getDirectionTo(enemy));
        if (prevRotation !== this.rotateFormation)
          bee.memory._trav = undefined;
      }
    }
    if (enemy && this.canBeOutDmged(bee.pos)) {
      bee.flee(enemy, this.order);
    } else {
      bee.goTo(moveTarget, opts);
      if (bee.targetPosition && this.canBeOutDmged(bee.targetPosition)) {
        bee.targetPosition = undefined;
        bee.memory._trav = undefined;
      }
    }
  }

  canBeOutDmged(pos: RoomPosition) {
    let roomInfo = Apiary.intel.getInfo(pos.roomName);
    if (roomInfo.safePlace)
      return false;
    for (let i = 0; i < this.formation.length; ++i) {
      let bee = this.formationBees[i];
      if (!bee)
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos)
        continue;
      let stats = Apiary.intel.getComplexStats(desiredPos, undefined, 3).current;
      let creepDmg = stats.dmgClose + stats.dmgRange;
      let towerDmg = Apiary.intel.getTowerAttack(desiredPos);
      let beeStats = Apiary.intel.getStats(bee.creep).current;
      if (towerDmg + creepDmg > this.stats.current.heal + beeStats.resist)
        return true;
    }
    return false;
  }

  run() {
    let enemy: Enemy["object"] | undefined;
    if (this.stats.current.dmgClose > 0 || this.stats.current.dmgRange > 0)
      enemy = Apiary.intel.getEnemy(this.formationCenter);
    else if (this.stats.current.dism > 0)
      enemy = Apiary.intel.getEnemyStructure(this.formationCenter);

    let healingTargets: { bee: Bee, heal: number }[] = [];
    if (this.stats.current.heal) {
      healingTargets = this.activeBees.filter(b => b.hits < b.hitsMax).map(b => { return { bee: b, heal: b.hitsMax - b.hits } });
      if (!healingTargets.length && enemy instanceof StructureTower) {
        let toHeal = enemy.pos.findClosest(this.activeBees);
        if (toHeal)
          healingTargets = [{ bee: toHeal, heal: Infinity }];
      }
    }

    _.forEach(this.activeBees, bee => {
      this.beeAct(bee, enemy, healingTargets);
    });

    let readyToGo = this.spawned === this.maxSpawns;
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
          bee.goTo(this.formationCenter);
      });
      return;
    }

    let centerBee = _.compact(this.formationBees)[0];
    if (!centerBee)
      return;

    let valid: number = this.validFormation();
    if (valid === OK) {
      this.stuckValue = 0;
      this.moveCenter(centerBee, enemy);
      let direction: DirectionConstant | undefined;
      if (centerBee.targetPosition && !centerBee.targetPosition.equal(centerBee))
        direction = centerBee.pos.getDirectionTo(centerBee.targetPosition);
      if (direction)
        _.forEach(this.activeBees, b => {
          if (b.ref === centerBee!.ref)
            return;
          let pos = b.pos.getPosInDirection(direction!);
          if (pos.isFree(true))
            b.targetPosition = pos;
        });
    } else {
      if (valid === ERR_NOT_IN_RANGE && this.stuckValue <= 4 && !centerBee.pos.getEnteranceToRoom()) {
        this.stuckValue += 1;
        valid = this.validateFormation();
      }
      if (valid !== OK) {
        this.stuckValue = 0;
        this.moveCenter(centerBee, enemy);
        for (let i = 0; i < this.formationBees.length; ++i) {
          let bee = this.formationBees[i];
          if (!bee || bee.ref === centerBee.ref)
            continue;
          let desiredPos = this.getDeisredPos(i);
          if (!desiredPos || !desiredPos.isFree(true))
            bee.goTo(centerBee, { movingTarget: true })
          else
            bee.goTo(desiredPos, { movingTarget: true })
        }
      }
    }

    this.formationCenter = centerBee.targetPosition && centerBee.targetPosition.isFree(true) ? centerBee.targetPosition : centerBee.pos;

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
}
