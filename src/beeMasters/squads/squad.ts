import type { Bee } from "bees/bee";
import type { CreepSetup } from "bees/creepSetups";
import { BOOST_MINERAL, BOOST_PARTS } from "cells/stage1/laboratoryCell";
import type { FlagOrder } from "orders/flagCommands";
import { profile } from "profiler/decorator";
import { SQUAD_VISUALS } from "settings";
import type {
  CreepAllBattleInfo,
  CreepBattleInfo,
  Enemy,
} from "spiderSense/intel";
import { beeStates, enemyTypes, hiveStates, roomStates } from "static/enums";
import { addResDict } from "static/utils";

import { SwarmMaster } from "../_SwarmMaster";

export type FormationPositions = [Pos, CreepSetup][];

// first tandem btw
// older model, but logic for other variations
// TODO remove old models
@profile
export abstract class SquadMaster extends SwarmMaster {
  // #region Properties (7)

  private readonly formationBees: (Bee | undefined)[] = [];

  private priority = 1 as const;
  private stats: CreepAllBattleInfo = {
    max: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
    current: {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    },
  };

  protected abstract formation: FormationPositions;

  public movePriority = 1 as const;
  public newBee = (bee: Bee) => {
    super.newBee(bee);
    for (let i = 0; i < this.formation.length; ++i)
      if (
        !this.formationBees[i] &&
        bee.ref.includes(this.formation[i][1].name)
      ) {
        this.formationBees[i] = bee;
        break;
      }
    if (this.spawned < Object.keys(this.bees).length)
      this.spawned = Object.keys(this.bees).length;
  };
  public stuckValue = 0;

  // #endregion Properties (7)

  // #region Constructors (1)

  public constructor(order: FlagOrder) {
    super(order);
    const extraPos = this.order.flag.memory.extraPos;
    if (
      !extraPos ||
      !("x" in extraPos) ||
      !("y" in extraPos) ||
      !("roomName" in extraPos)
    )
      this.order.flag.memory.extraPos = this.hive.isBattle
        ? this.hive.pos
        : this.hive.rest;
    if (![TOP, BOTTOM, LEFT, RIGHT].includes(this.formationRotation))
      this.formationRotation = TOP;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (8)

  public get desiredPoss() {
    const ans = [];
    for (let i = 0; i < this.formationBees.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i);
      if (desiredPos) ans.push({ pos: desiredPos });
    }
    return ans;
  }

  public get emergency() {
    return (
      !!this.beesAmount ||
      (this.hive.state !== hiveStates.battle &&
        this.hive.state !== hiveStates.lowenergy)
    );
  }

  public get formationRotation() {
    return this.order.flag.memory.extraInfo as TOP | BOTTOM | LEFT | RIGHT;
  }

  public set formationRotation(value: TOP | BOTTOM | LEFT | RIGHT) {
    this.order.flag.memory.extraInfo = value;
  }

  public get maxSpawns() {
    return this.formation.length;
  }

  public set maxSpawns(_) {}

  public get targetBeeCount() {
    return this.formation.length;
  }

  public set targetBeeCount(_) {}

  // #endregion Public Accessors (8)

  // #region Protected Accessors (3)

  protected get checkup() {
    return true;
  }

  protected get formationCenter() {
    const pos = this.order.flag.memory.extraPos!;
    return new RoomPosition(pos.x, pos.y, pos.roomName);
  }

  protected set formationCenter(value) {
    this.order.flag.memory.extraPos = value;
  }

  // #endregion Protected Accessors (3)

  // #region Public Methods (7)

  public beeAct(
    bee: Bee,
    target: Creep | PowerCreep | Structure | undefined | null,
    healingTargets: { bee: Bee; heal: number }[]
  ) {
    let action1;
    let action2;

    const beeStats = Apiary.intel.getStats(bee.creep).current;

    const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);
    let healingTarget: { bee: Bee | Creep | null; heal: number } = {
      bee: null,
      heal: 0,
    };

    const rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    if (beeStats.dmgRange > 0) {
      if (rangeToTarget <= 3 && !(target instanceof Structure))
        action2 = () => bee.rangedAttack(target!);
      else {
        let tempTargets = roomInfo.enemies.filter(
          (e) => e.object.pos.getRangeTo(bee) <= 3
        );
        const tempNoRamp = tempTargets.filter(
          (e) =>
            !e.object.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.hits > 10000)
              .length
        );
        if (tempNoRamp.length) tempTargets = tempNoRamp;
        else if (rangeToTarget <= 3) {
          tempTargets = [];
          action2 = () => bee.rangedAttack(target!);
        }
        if (tempTargets.length) {
          const tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
            if (ans === 0)
              ans =
                bee.pos.getRangeTo(curr.object) -
                bee.pos.getRangeTo(prev.object);
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
        const tempTargets = roomInfo.enemies.filter(
          (e) =>
            e.type === enemyTypes.static && e.object.pos.getRangeTo(bee) <= 1
        );
        if (tempTargets.length) {
          const tempTarget = tempTargets.reduce((prev, curr) =>
            prev.dangerlvl < curr.dangerlvl ? curr : prev
          );
          action1 = () => bee.dismantle(tempTarget.object as Structure);
        }
      }
    } else if (beeStats.dmgClose > 0) {
      if (rangeToTarget <= 1) action1 = () => bee.attack(target!);
      else {
        let tempTargets = roomInfo.enemies.filter(
          (e) => e.object.pos.getRangeTo(bee) <= 1
        );
        const tempNoRamp = tempTargets.filter(
          (e) =>
            !e.object.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.hits > 10000)
              .length
        );
        if (tempNoRamp.length) tempTargets = tempNoRamp;
        if (tempTargets.length) {
          const tempTarget = tempTargets.reduce((prev, curr) => {
            let ans = prev.type - curr.type;
            if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
            if (ans === 0)
              ans =
                bee.pos.getRangeTo(curr.object) -
                bee.pos.getRangeTo(prev.object);
            return ans < 0 ? curr : prev;
          });
          action1 = () => bee.attack(tempTarget.object);
        }
      }
    }

    if (beeStats.heal > 0) {
      if (healingTargets.length)
        healingTarget = healingTargets.reduce((prev, curr) => {
          let ans =
            (curr.bee.pos.getRangeTo(bee) || 1) -
            (prev.bee.pos.getRangeTo(bee) || 1);
          if (ans === 0) ans = prev.heal - curr.heal;
          return ans < 0 ? curr : prev;
        });
      if (!healingTarget.bee)
        healingTarget.bee = bee.pos.findClosest(
          _.filter(
            bee.pos.findInRange(FIND_MY_CREEPS, 3),
            (c) => c.hits < c.hitsMax
          )
        );

      if (!healingTarget.bee && !action1 && roomInfo.dangerlvlmax > 3)
        healingTarget.bee = bee;

      const rangeToHealingTarget = healingTarget.bee
        ? bee.pos.getRangeTo(healingTarget.bee)
        : Infinity;
      if (
        rangeToHealingTarget <= 1 &&
        (!action1 || beeStats.heal > beeStats.dism + beeStats.dmgClose)
      ) {
        action1 = () => {
          healingTarget.heal = Math.max(
            0.1,
            healingTarget.heal - beeStats.heal
          );
          const ans = bee.heal(healingTarget.bee!);
          return ans;
        };
      } else if (
        rangeToHealingTarget <= 3 &&
        ((!action2 && !action1) || beeStats.heal > beeStats.dmgRange)
      )
        action2 = () => bee.rangedHeal(healingTarget.bee!);
    }

    if (action1) action1();

    if (action2) action2();

    return OK;
  }

  public getDeisredPos(
    i: number,
    centerPos: RoomPosition = this.formationCenter
  ) {
    const p = this.formation[i][0];
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
    if (x < 0 || y < 0 || x > 49 || y > 49) return null;
    return new RoomPosition(x, y, centerPos.roomName);
  }

  public getPathArgs(centerBeeRef: string): TravelToOptions {
    return {
      useFindRoute: true,
      maxOps: 5000,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        if (!(roomName in Game.rooms)) return undefined;
        const roomState = Apiary.intel.getRoomState(roomName);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y) {
            const moveMent = this.getSquadMoveMentValue(
              new RoomPosition(x, y, roomName),
              centerBeeRef
            );
            if (moveMent > 5 && roomState === roomStates.ownedByEnemy)
              matrix.set(x, y, Math.min(moveMent * 2, 255));
            else matrix.set(x, y, moveMent);
          }
        return matrix;
      },
    };
  }

  public getSquadMoveMentValue(
    pos: RoomPosition,
    centerRef: string,
    ignoreEnemyCreeps = true
  ) {
    let sum = 0;
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    for (let i = 0; i < this.formation.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i, pos);
      if (
        !desiredPos ||
        terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_WALL
      )
        if (bee.ref === centerRef) return 255;
        else sum += 30;
      else if (desiredPos.enteranceToRoom) sum += 20;
      else if (!desiredPos.isFree())
        if (bee.ref === centerRef) return 255;
        else sum += 30;
      else if (
        !ignoreEnemyCreeps &&
        desiredPos.lookFor(LOOK_CREEPS).filter((c) => !c.my).length
      )
        sum += 20;
      else if (
        terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_SWAMP &&
        !(
          desiredPos.roomName in Game.rooms &&
          desiredPos
            .lookFor(LOOK_STRUCTURES)
            .filter((s) => s.structureType === STRUCTURE_ROAD).length
        )
      )
        sum += 5;
      else sum += 1;
    }
    return Math.ceil(sum / this.activeBees.length);
  }

  public run() {
    this.preRunBoost();
    let enemy: Enemy["object"] | undefined;
    let roomInfo = Apiary.intel.getInfo(this.formationCenter.roomName, 10);
    if (roomInfo.roomState === roomStates.ownedByEnemy)
      roomInfo = Apiary.intel.getInfo(this.formationCenter.roomName, 4);
    if (this.stats.current.dmgClose + this.stats.current.dmgRange > 0) {
      const enemies = roomInfo.enemies.filter(
        (e) =>
          e.dangerlvl === roomInfo.dangerlvlmax ||
          (e.dangerlvl >= 4 &&
            this.formationCenter.getRangeTo(e.object) <= 5 &&
            !e.object.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.hits > 10000)
              .length)
      );
      if (enemies.length)
        enemy = enemies.reduce((prev, curr) => {
          let ans =
            this.formationCenter.getRangeTo(curr.object) -
            this.formationCenter.getRangeTo(prev.object);
          if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
          return ans < 0 ? curr : prev;
        }).object;
    } else if (this.stats.current.dism > 0)
      enemy = Apiary.intel.getEnemyStructure(this.formationCenter, 50);

    let healingTargets: { bee: Bee; heal: number }[] = [];
    if (this.stats.current.heal)
      healingTargets = this.activeBees
        .filter((b) => b.hits < b.hitsMax)
        .map((b) => {
          return { bee: b, heal: b.hitsMax - b.hits };
        });

    _.forEach(this.activeBees, (bee) => {
      this.beeAct(bee, enemy, healingTargets);
    });

    // if all spawned and boosted we go
    const readyToGo =
      this.spawned >= this.maxSpawns &&
      !_.some(this.bees, (b) => b.state === beeStates.boosting);

    if (!readyToGo) {
      _.forEach(this.activeBees, (bee) => {
        if (bee.state !== beeStates.boosting) bee.goRest(this.formationCenter);
      });
      return;
    }

    const centerBee = _.compact(this.formationBees)[0];
    if (!centerBee) return;

    const valid: number = this.validFormation();

    if (this.stuckValue > 0 && valid === OK)
      centerBee.memory._trav.path = undefined;

    if (valid === OK || this.canValidate() !== OK || this.stuckValue > 6) {
      this.stuckValue = 0;
      this.moveCenter(centerBee, enemy);
    } else this.stuckValue += 1;

    const desired = this.desiredPoss;
    for (let i = 0; i < this.formationBees.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !desiredPos.isFree()) {
        if (
          centerBee.targetPosition &&
          !centerBee.targetPosition.equal(centerBee.pos)
        )
          bee.goTo(centerBee, { obstacles: desired });
        else bee.goRest(centerBee.pos);
      } else if (bee.pos.isNearTo(desiredPos)) {
        if (valid === OK || !bee.pos.equal(desiredPos))
          bee.targetPosition = desiredPos;
      } else bee.goTo(desiredPos);
    }

    if (SQUAD_VISUALS)
      for (let i = 0; i < this.formationBees.length; ++i) {
        const bee = this.formationBees[i];
        if (!bee) continue;
        const desiredPos = this.getDeisredPos(i);
        if (!desiredPos) continue;
        const vis = Apiary.visuals;
        if (
          vis.caching[desiredPos.roomName] &&
          Game.time > vis.caching[desiredPos.roomName].lastRecalc
        )
          continue;
        const style: CircleStyle = {};
        if (this.formationBees[i] && bee.ref === centerBee.ref)
          style.fill = "#FF0000";
        new RoomVisual(desiredPos.roomName).circle(
          desiredPos.x,
          desiredPos.y,
          style
        );
      }
  }

  public update() {
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
      },
      current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      },
    };

    _.forEach(this.activeBees, (b) => {
      if (b.ticksToLive < 5) return;
      const stats = Apiary.intel.getStats(b.creep);
      for (const i in stats.max) {
        this.stats.max[i as keyof CreepBattleInfo] +=
          stats.max[i as keyof CreepBattleInfo];
        this.stats.current[i as keyof CreepBattleInfo] +=
          stats.current[i as keyof CreepBattleInfo];
      }
    });
    if (this.checkBees(this.emergency) && this.checkup) {
      for (let i = 0; i < this.formation.length; ++i) {
        if (!this.formationBees[i])
          this.wish({
            setup: this.formation[i][1],
            priority: this.priority,
          });
      }
    } else if (_.some(this.bees, (b) => b.state === beeStates.boosting)) {
      this.checkup;
    }

    for (let i = 0; i < this.formationBees.length; ++i) {
      const bee = this.formationBees[i];
      if (bee && !Object.keys(this.bees).includes(bee.ref))
        this.formationBees[i] = undefined;
    }
  }

  public validFormation() {
    for (let i = 0; i < this.formation.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const beePos = bee.pos;
      const desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !beePos.equal(desiredPos)) return ERR_NOT_IN_RANGE;
    }

    return OK;
  }

  // #endregion Public Methods (7)

  // #region Protected Methods (1)

  protected checkMinerals(
    body: BodyPartConstant[],
    coef = this.formation.length
  ) {
    if (this.boosts === undefined) return true;
    if (
      !this.hive.cells.storage ||
      (this.hive.cells.lab &&
        !Object.keys(this.hive.cells.lab.laboratories).length &&
        this.boosts.length)
    )
      return false;
    let ans = true;
    for (const b of this.boosts) {
      const res = BOOST_MINERAL[b.type][b.lvl];
      const amountNeeded =
        LAB_BOOST_MINERAL *
        _.sum(body, (bb) => (bb === BOOST_PARTS[b.type] ? 1 : 0)) *
        coef;
      if (
        amountNeeded &&
        this.hive.cells.storage.getUsedCapacity(res) < amountNeeded
      ) {
        addResDict(this.hive.mastersResTarget, res, amountNeeded);
        ans = false;
      }
    }
    return ans;
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (5)

  private canBeOutDmged(pos: RoomPosition) {
    for (let i = 0; i < this.formation.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos) continue;
      const roomInfo = Apiary.intel.getInfo(pos.roomName);
      let stats;
      if (
        roomInfo.roomState === roomStates.SKfrontier ||
        roomInfo.roomState === roomStates.SKcentral
      )
        stats = Apiary.intel.getComplexStats(desiredPos).current;
      else stats = Apiary.intel.getComplexStats(desiredPos).current; // , 3, 1
      const creepDmg = stats.dmgClose + stats.dmgRange;
      const towerDmg = Apiary.intel.getTowerAttack(desiredPos);
      const beeStats = Apiary.intel.getStats(bee.creep);
      const myStats = Apiary.intel.getComplexMyStats(desiredPos).current;
      const heal = Math.max(myStats.heal * 0.75, this.stats.current.heal); // 0.75 cause won't heal somtimes in a brawl
      if (
        towerDmg * 0.5 + creepDmg >
        heal + Math.min(beeStats.current.resist, (heal * 0.7) / 0.3)
      )
        return true;
    }
    return false;
  }

  private canValidate() {
    const terrain = Game.map.getRoomTerrain(this.formationCenter.roomName);
    const poss = this.desiredPoss;
    for (const desired of poss) {
      if (
        !desired.pos.isFree() ||
        desired.pos.enteranceToRoom ||
        terrain.get(desired.pos.x, desired.pos.y) === TERRAIN_MASK_SWAMP
      )
        return ERR_NO_PATH;
    }
    return OK;
  }

  private checkRotation(direction: DirectionConstant) {
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
            break;
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

  private moveCenter(
    bee: Bee,
    enemy: Creep | Structure | PowerCreep | undefined | null
  ) {
    let moveTarget = this.pos;
    let opt = this.getPathArgs(bee.ref);
    const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 10);
    let fatigue = 0;

    if (
      roomInfo.roomState === roomStates.ownedByEnemy ||
      roomInfo.dangerlvlmax >= 8
    ) {
      _.forEach(this.activeBees, (b) => {
        fatigue += b.creep.fatigue;
      });
      if (fatigue) {
        bee.stop();
        return;
      }
    }

    let busy = false;
    const notNearExit =
      bee.pos.x > 2 && bee.pos.x < 47 && bee.pos.y > 2 && bee.pos.y < 47;
    if (enemy && bee.pos.roomName === this.pos.roomName) {
      moveTarget =
        this.stats.current.dism && this.pos.getRangeTo(this.formationCenter) > 3
          ? moveTarget
          : enemy.pos;
      opt.movingTarget = true;
      if (notNearExit && bee.pos.getRangeTo(enemy) < 10) {
        const rotate = this.checkRotation(bee.pos.getDirectionTo(enemy));
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

      if (
        moveTarget.getRangeTo(bee) <= 3 &&
        (!bee.targetPosition || bee.targetPosition.equal(bee.pos)) &&
        this.getSquadMoveMentValue(bee.pos, bee.ref, false) > 5
      ) {
        const poss = bee.pos.getOpenPositions();
        if (poss.length) {
          const newPos = poss.reduce((prev, curr) => {
            let ans = curr.getRangeTo(moveTarget) - prev.getRangeTo(moveTarget);
            if (ans === 0)
              ans =
                this.getSquadMoveMentValue(curr, bee.ref, false) -
                this.getSquadMoveMentValue(prev, bee.ref, false);
            return ans < 0 ? curr : prev;
          });
          if (!newPos.equal(bee.pos)) bee.goTo(newPos, opt);
        }
      }

      if (!roomInfo.safePlace && this.stats.current.heal) {
        if (this.canBeOutDmged(bee.pos)) {
          opt = bee.getFleeOpt(opt);
          const exit = bee.pos.findClosest(
            Game.rooms[bee.pos.roomName].find(FIND_EXIT)
          );
          bee.goTo(exit || this.pos, opt);
        } else if (bee.targetPosition && this.canBeOutDmged(bee.targetPosition))
          bee.stop();
        else if (
          roomInfo.roomState === roomStates.ownedByEnemy &&
          notNearExit
        ) {
          const formationBreak =
            bee.targetPosition &&
            this.getSquadMoveMentValue(bee.targetPosition, bee.ref, false) > 5;
          if (formationBreak) bee.stop();
        }
      }

      this.formationCenter =
        bee.targetPosition && bee.targetPosition.isFree()
          ? bee.targetPosition
          : bee.pos;
    } else bee.goTo(this.formationCenter);
  }

  private rotate(direction: -1 | 1) {
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
    const possibleCenters = this.formationCenter.getPositionsInRange(1);
    const calcErrors = (possibleCenter: RoomPosition) => {
      let sum = 0;
      for (let i = 0; i < this.formationBees.length; ++i) {
        const bee = this.formationBees[i];
        if (!bee) continue;
        const desiredPos = this.getDeisredPos(i, possibleCenter);
        if (!desiredPos || !desiredPos.isNearTo(bee)) ++sum;
      }
      return sum;
    };
    let newCenter = this.formationCenter;
    let errors = calcErrors(newCenter);

    for (const pos of possibleCenters) {
      const newError = calcErrors(pos);
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

  // #endregion Private Methods (5)
}
