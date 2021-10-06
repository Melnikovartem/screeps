import { SwarmMaster } from "../_SwarmMaster";

import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { CreepSetup } from "../../bees/creepSetups";
import type { CreepAllBattleInfo, CreepBattleInfo, Enemy } from "../../abstract/intelligence";

export type FormationPosition = [Pos, CreepSetup];
//first tandem btw
@profile
export abstract class SquadMaster extends SwarmMaster {
  formation: FormationPosition[] = [];
  formationBees: Bee[] = [];
  formationCenter: RoomPosition = this.hive.state === hiveStates.battle ? this.hive.getPos("center") : this.hive.pos;
  formationRotation: TOP | BOTTOM | LEFT | RIGHT = TOP;
  targetBeeCount = 1;
  maxSpawns = 1;
  movePriority = <2>2;
  priority = <1>1;
  boost = true;
  boostMove = true;
  stats: CreepAllBattleInfo = {
    max: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
    }, current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
    }
  };

  newBee(bee: Bee) {
    super.newBee(bee);
    for (let i = 0; i < this.formation.length; ++i)
      if (!this.formationBees[i] && bee.ref.includes(this.formation[i][1].name)) {
        this.formationBees[i] = bee;
        break;
      }
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
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
      }
    };

    _.forEach(this.activeBees, b => {
      let stats = Apiary.intel.getStats(b.creep);
      for (let i in stats.max) {
        this.stats.max[<keyof CreepBattleInfo>i] += stats.max[<keyof CreepBattleInfo>i];
        this.stats.current[<keyof CreepBattleInfo>i] += stats.current[<keyof CreepBattleInfo>i]
      }
    });

    this.targetBeeCount = this.formation.length;
    this.maxSpawns = this.formation.length;

    if (this.checkBees()) {
      for (let i = 0; i < this.formation.length; ++i) {
        if (!this.formationBees[i])
          this.wish({
            setup: this.formation[i][1],
            amount: 1,
            priority: this.priority,
          }, this.ref + "_" + i);
      }
    }
  }

  getDeisredPos(i: number, pos: RoomPosition = this.formationCenter) {
    let p = this.formation[i][0];
    let [x, y] = [pos.x, pos.y];
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
    return new RoomPosition(x, y, pos.roomName);
  }

  isAlive(bee: Bee | undefined) {
    return bee && Object.keys(this.bees).includes(bee.ref);
  }

  validFormation() {
    if (this.maxSpawns !== this.spawned)
      return false;
    let validFormation = true;
    for (let i = 0; i < this.formation.length; ++i) {
      if (!this.isAlive(this.formationBees[i]))
        continue;
      let beePos = this.formationBees[i]!.pos;
      let desiredPos = this.getDeisredPos(i);
      if (!desiredPos || beePos.x !== desiredPos.x || beePos.y !== desiredPos.y || beePos.roomName !== desiredPos.roomName)
        validFormation = false;
    }

    return validFormation;
  }

  getSquadMoveMentValue(pos: RoomPosition) {
    let max = 1;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      if (!this.isAlive(this.formationBees[i]))
        continue;
      let desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos)
        continue; // exit
      if (!desiredPos.isFree(true))
        return 64;
      if (terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
        max = 5;
    }
    return max;
  }

  validateFormation() {
    let terrain = Game.map.getRoomTerrain(this.formationCenter.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      let desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !desiredPos.isFree(true) && this.isAlive(this.formationBees[i]) || terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP)
        return false;
    }

    for (let i = 0; i < this.formationBees.length; ++i) {
      if (!this.isAlive(this.formationBees[i]))
        continue;
      let bee = this.formationBees[i];
      let desiredPos = this.getDeisredPos(i)!;
      bee.goTo(desiredPos, { movingTarget: true, ignoreCreeps: false });
      bee.actionPosition = desiredPos;
    }
    return true;
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep | undefined | null, healingTarget: Creep | Bee | undefined | null) {
    let action1;
    let action2;

    let beeStats = Apiary.intel.getStats(bee.creep).current;

    if (beeStats.heal > 0 && !healingTarget)
      healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    let rangeToHealingTarget = healingTarget ? bee.pos.getRangeTo(healingTarget) : Infinity;


    if (rangeToTarget <= 3 && beeStats.dmgRange > 0)
      action2 = () => bee.rangedAttack(target);
    else if (rangeToHealingTarget <= 3 && rangeToHealingTarget > 1 && beeStats.heal > 0)
      action2 = () => bee.rangedHeal(healingTarget);

    if (rangeToHealingTarget === 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget);
    else if (rangeToTarget === 1) {
      if (beeStats.dism > 0 && target instanceof Structure)
        action1 = () => bee.dismantle(target);
      else if (beeStats.dmgClose > 0)
        action1 = () => bee.attack(target);
    }

    if (action1)
      action1();

    if (action2)
      action2();

    return OK;
  }

  moveCenter(bee: Bee, enemy: Creep | Structure | PowerCreep | undefined | null) {
    let moveTarget = enemy && (bee.pos.roomName === this.order.pos.roomName || bee.pos.getRangeTo(enemy) < 5) ? enemy.pos : this.order.pos;
    bee.goTo(moveTarget, {
      movingTarget: true, goInDanger: true, roomCallback: (roomName: string, matrix: CostMatrix) => {
        if (!(roomName in Game.rooms))
          return undefined;
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y) {
            let moveMent = this.getSquadMoveMentValue(new RoomPosition(x, y, roomName))
            matrix.set(x, y, moveMent);
          }
        return matrix;
      }
    });
    let direction: DirectionConstant | undefined;
    if (bee.targetPosition)
      direction = bee.pos.getDirectionTo(bee.targetPosition);


    return direction;
  }

  run() {
    let enemy: Enemy["object"] | undefined;

    if (this.stats.current.dmgClose > 0)
      enemy = Apiary.intel.getEnemy(this.formationCenter, 1);
    else if (this.stats.current.dism > 0)
      enemy = Apiary.intel.getEnemy(this.formationCenter, 1, false);

    let healingTarget: Bee | undefined;
    if (this.stats.current.heal) {
      let healingTargets = this.activeBees.filter(b => b.hits < b.hitsMax);
      if (healingTargets.length)
        healingTarget = healingTargets.reduce((prev, curr) => curr.hitsMax - curr.hits > prev.hitsMax - prev.hits ? curr : prev);
    }

    _.forEach(this.activeBees, bee => {
      this.beeAct(bee, enemy, healingTarget);
    });

    let readyToGo = true;
    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting) {
        if (!this.hive.cells.lab
          || this.hive.cells.lab.askForBoost(bee, [{ type: "rangedAttack" }, { type: "attack" }, { type: "heal" }, { type: "fatigue" }]) === OK)
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

    let centerBee = this.formationBees.filter(b => this.isAlive(b))[0];
    if (!centerBee)
      return;
    if (this.validFormation()) {
      let direction = this.moveCenter(centerBee, enemy);
      if (direction)
        _.forEach(this.activeBees, b => {
          let pos = b.pos.getPosInDirection(direction!);
          if (pos.isFree(true))
            b.targetPosition = pos;
        });
    } else if (!this.validateFormation()) {
      this.moveCenter(centerBee, enemy);
      _.forEach(this.activeBees, bee => this.isAlive(bee) && bee.goTo(this.formationCenter, { movingTarget: true }));
    }

    this.formationCenter = centerBee.targetPosition && centerBee.targetPosition.isFree(true) ? centerBee.targetPosition : centerBee.pos;

    new RoomVisual(this.formationCenter.roomName).circle(this.formationCenter.x, this.formationCenter.y);
  }
}