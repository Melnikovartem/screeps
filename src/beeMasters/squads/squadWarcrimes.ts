import { SwarmMaster } from "beeMasters/_SwarmMaster";
import type { Bee } from "bees/bee";
import { CreepSetup } from "bees/creepSetups";
import { BOOST_MINERAL, BOOST_PARTS } from "cells/stage1/laboratoryCell";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import type {
  CreepAllBattleInfo,
  CreepBattleInfo,
} from "spiderSense/intel-creep";
import type { Enemy } from "spiderSense/intel-runtime";
import { beeStates, enemyTypes, hiveStates, roomStates } from "static/enums";
import { addResDict } from "static/utils";

import type { Boosts } from "../_Master";

export type FormationPositions = [Pos, CreepSetup][];

type SquadEnemy = Creep | PowerCreep | Structure | undefined | null;

/** last seen position of the target is in pos */
export interface SquadInfo {
  // #region Properties (7)

  /** center of the squad */
  center: { x: number; y: number; roomName: string };
  /** roomName of enterance */
  ent: string;
  /** rotation of the squad */
  rotation: TOP | BOTTOM | LEFT | RIGHT;
  /** check if the suqad is stuck */
  seidgeStuck: number;
  /** current rotation of the squad */
  setup: CreepSetup[];
  /** last time the target was seen and updated */
  targetLastUpdated: number;
  /** targetId */
  targetid: Id<_HasId> | "";

  // #endregion Properties (7)
}

const FORMATION = {
  normal: [
    // normal formation
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  enterance: [
    // formation to enter the room
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: -2, y: 0 },
  ],
};

@profile
export class SquadWarCrimesMaster extends SwarmMaster<SquadInfo> {
  // #region Properties (7)

  public formationBees: (Bee | undefined)[] = [];
  public movePriority = 1 as const;
  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    for (let i = 0; i < this.setup.length; ++i)
      // match with formatin bee by name
      if (!this.formationBees[i] && bee.ref.includes(this.setup[i].name)) {
        this.formationBees[i] = bee;
        break;
      }
  };
  public priority = 1 as const;
  public setupParsed?: CreepSetup[];
  public stats: CreepAllBattleInfo = {
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
  public stuckValue = 0;

  // #endregion Properties (7)

  // #region Constructors (1)

  public constructor(order: SwarmOrder<SquadInfo>) {
    super(order);
    Apiary.war.squads[this.ref] = this;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (16)

  public override get boosts(): Boosts {
    return [
      { type: "fatigue", lvl: 2 },
      { type: "rangedAttack", lvl: 2 },
      { type: "heal", lvl: 2 },
      { type: "damage", lvl: 2 },
      { type: "dismantle", lvl: 2 },
    ];
  }

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

  public get enemy() {
    return Game.getObjectById(this.info.targetid);
  }

  public set enemy(value) {
    if (value) this.info.targetid = value.id;
  }

  public get formationCenter() {
    const pos = this.info.center;
    return new RoomPosition(pos.x, pos.y, pos.roomName);
  }

  public set formationCenter(value) {
    this.info.center = value;
  }

  public get formationRotation() {
    return this.info.rotation;
  }

  public set formationRotation(value: TOP | BOTTOM | LEFT | RIGHT) {
    this.info.rotation = value;
  }

  public get maxSpawns() {
    return this.setup.length;
  }

  public set maxSpawns(_) {}

  public get poss(): Pos[] {
    if (
      this.pos.x <= 2 ||
      this.pos.x >= 48 ||
      this.pos.y <= 2 ||
      this.pos.y >= 48
    )
      return FORMATION.enterance;
    return FORMATION.normal;
  }

  public get setup(): CreepSetup[] {
    // as we go from memory we need to parse into an object
    if (!this.setupParsed) {
      this.setupParsed = [];
      for (const f of this.info.setup) {
        this.setupParsed.push(
          new CreepSetup(
            f.name,
            {
              patternLimit: f.patternLimit,
              pattern: f.pattern,
              fixed: f.fixed,
            },
            f.moveMax,
            f.scheme,
            f.ignoreCarry,
            f.ignoreMove
          )
        );
      }
    }
    return this.setupParsed;
  }

  public get stuckSiedge() {
    return this.info.seidgeStuck;
  }

  public set stuckSiedge(value) {
    this.info.seidgeStuck = value;
  }

  public get targetBeeCount() {
    return this.setup.length;
  }

  // #endregion Public Accessors (16)

  // #region Public Methods (10)

  public beeAct(
    bee: Bee,
    target: SquadEnemy,
    healingTargets: { bee: Bee; heal: number }[],
    tempTargets: Enemy[]
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
        let tempRangeTargets = tempTargets.filter(
          (e) => e.object.pos.getRangeTo(bee) <= 3
        );
        if (!tempRangeTargets.length)
          if (rangeToTarget <= 3) action2 = () => bee.rangedAttack(target!);
          else
            tempRangeTargets = roomInfo.enemies.filter(
              (e) => e.object.pos.getRangeTo(bee) <= 3
            );
        if (tempRangeTargets.length) {
          const tempTarget = tempRangeTargets.reduce((prev, curr) => {
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
        let tempDismTargets = tempTargets.filter(
          (e) =>
            e.type === enemyTypes.static && e.object.pos.getRangeTo(bee) <= 1
        );
        if (!tempDismTargets.length)
          tempDismTargets = roomInfo.enemies.filter(
            (e) =>
              e.type === enemyTypes.static && e.object.pos.getRangeTo(bee) <= 1
          );
        if (tempDismTargets.length) {
          const tempTarget = tempDismTargets.reduce((prev, curr) =>
            prev.dangerlvl < curr.dangerlvl ? curr : prev
          );
          action1 = () => bee.dismantle(tempTarget.object as Structure);
        }
      }
    } else if (beeStats.dmgClose > 0) {
      if (rangeToTarget <= 1) action1 = () => bee.attack(target!);
      else {
        let tempCloseTargets = tempTargets.filter(
          (e) => e.object.pos.getRangeTo(bee) <= 1
        );
        if (!tempCloseTargets.length)
          tempCloseTargets = roomInfo.enemies.filter(
            (e) => e.object.pos.getRangeTo(bee) <= 1
          );
        if (tempCloseTargets.length) {
          const tempTarget = tempCloseTargets.reduce((prev, curr) => {
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

      if (!healingTarget.bee && !action1 && roomInfo.dangerlvlmax >= 4)
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

  public override defaultInfo(): SquadInfo {
    // should be innited before as some info comes from decision makers
    return {
      seidgeStuck: 0,
      center: this.hive.isBattle ? this.hive.pos : this.hive.rest,

      targetLastUpdated: -1,
      targetid: "",

      rotation: TOP,
      setup: [],
      ent: this.hiveName,
    };
  }

  public override delete() {
    super.delete();
    delete Apiary.war.squads[this.ref];
  }

  /** based on formation get position where the bee should be */
  public getDeisredPos(
    i: number,
    centerPos: RoomPosition = this.formationCenter
  ) {
    const p = this.poss[i];
    let [x, y] = [centerPos.x, centerPos.y];
    if (!this.formationBees[0])
      return new RoomPosition(x, y, centerPos.roomName);
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

  public getPathArgs(centerBeeRef: string, checkFlee = false): TravelToOptions {
    return {
      useFindRoute: true,
      maxOps: 5000,
      ensurePath: checkFlee ? true : false,
      // allowHostile: true,
      roomCallback: (roomName: string, matrix: CostMatrix) => {
        const roomInfo = Apiary.intel.getInfo(roomName, Infinity);
        if (
          (roomInfo.roomState === roomStates.corridor ||
            roomInfo.roomState === roomStates.SKcentral ||
            roomInfo.roomState === roomStates.noOwner) &&
          roomInfo.dangerlvlmax < 7
        )
          return undefined;
        if (!(roomName in Game.rooms)) return undefined;
        for (let x = 1; x <= 48; ++x)
          for (let y = 1; y <= 48; ++y) {
            const moveMent = this.getSquadMoveMentValue(
              new RoomPosition(x, y, roomName),
              centerBeeRef
            );
            if (moveMent > 5 && roomInfo.roomState === roomStates.ownedByEnemy)
              matrix.set(
                x,
                y,
                Math.min(moveMent * 2 * (checkFlee ? 2 : 1), 255)
              );
            else {
              matrix.set(x, y, moveMent);
              if (checkFlee) {
                const centerBee = this.bees[centerBeeRef];
                const pos = new RoomPosition(x, y, roomName);
                if (
                  centerBee &&
                  centerBee.pos.getRangeTo(pos) === 1 &&
                  this.canBeOutDmged(pos, -1)
                )
                  matrix.set(x, y, Math.min(matrix.get(x, y) * 2, 255));
              }
            }
          }
        return matrix;
      },
    };
  }

  public getSquadDistance(pos: RoomPosition) {
    let sum = 0;
    for (let i = 0; i < this.setup.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos) continue;
      sum += desiredPos.getRangeTo(pos);
    }
    return Math.ceil(sum / this.activeBees.length);
  }

  public getSquadMoveMentValue(
    pos: RoomPosition,
    centerRef: string,
    ignoreEnemyCreeps = true
  ) {
    let sum = 0;
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    for (let i = 0; i < this.setup.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i, pos);
      if (
        !desiredPos ||
        terrain.get(desiredPos.x, desiredPos.y) === TERRAIN_MASK_WALL
      )
        if (bee.ref === centerRef) return 255;
        else sum += 100;
      else if (desiredPos.enteranceToRoom) sum += 20;
      else if (!desiredPos.isFree())
        if (bee.ref === centerRef) return 255;
        else sum += 100;
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
    if (
      this.formationCenter.roomName === this.pos.roomName &&
      (!this.enemy || this.info.targetLastUpdated + 100 < Game.time)
    ) {
      const anyDmg =
        this.stats.current.dmgClose +
        this.stats.current.dmgRange +
        this.stats.current.dism;

      if (anyDmg) {
        const enemy = Apiary.war.getEnemy(
          this.info.targetLastUpdated === -1 ? this.pos : this.formationCenter,
          this.stats.current.dism > 0
        );

        if (enemy) {
          this.enemy = enemy;
          this.info.targetLastUpdated = Game.time;
        }
      }
    }

    let healingTargets: { bee: Bee; heal: number }[] = [];
    if (this.stats.current.heal)
      healingTargets = this.activeBees
        .filter((b) => b.hits < b.hitsMax)
        .map((b) => {
          return { bee: b, heal: b.hitsMax - b.hits };
        });

    const tempTargets = Apiary.intel
      .getInfo(this.formationCenter.roomName, 20)
      .enemies.filter(
        (e) =>
          e.object.pos.getRangeTo(this.formationCenter) <= 5 &&
          !e.object.pos
            .lookFor(LOOK_STRUCTURES)
            .filter(
              (s) =>
                (s.structureType === STRUCTURE_RAMPART ||
                  s.structureType === STRUCTURE_WALL) &&
                s.hits > 10000
            ).length
      );
    _.forEach(this.activeBees, (bee) =>
      this.beeAct(bee, this.enemy as SquadEnemy, healingTargets, tempTargets)
    );

    // if all spawned and boosted we go
    const readyToGo =
      this.parent.spawned >= this.maxSpawns &&
      !_.some(this.bees, (b) => b.state === beeStates.boosting);

    if (!readyToGo) {
      _.forEach(this.activeBees, (bee) => {
        if (bee.state !== beeStates.boosting) bee.goRest(this.formationCenter);
      });
      return;
    }

    let centerBee = this.formationBees[0];
    if (!centerBee) centerBee = this.activeBees[0];

    const valid: number = this.validFormation();
    if (
      valid === OK ||
      this.stuckValue > 6 ||
      (this.formationCenter.getRoomRangeTo(this.pos) > 1 &&
        !this.activeBees.filter(
          (b) => b.pos.getRangeTo(this.formationCenter) > 5
        ).length) ||
      this.canValidate() !== OK
    ) {
      this.stuckValue = 0;
      this.moveCenter(centerBee, this.enemy as SquadEnemy, tempTargets);
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

    if (Memory.settings.richMovement) this.visualsSquad(centerBee.ref);
  }

  public override update() {
    super.update();

    if (!this.info) {
      this.delete();
      return;
    }

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
      const stats = Apiary.intel.getStats(b.creep);
      for (const statType in stats.max) {
        const type = statType as keyof CreepBattleInfo;
        this.stats.max[type] += stats.max[type];
        this.stats.current[type] += stats.current[type];
      }
    });

    if (this.checkBees(this.emergency, CREEP_LIFE_TIME / 2) && this.checkup()) {
      // spawn if have minerals
      for (let i = 0; i < this.setup.length; ++i) {
        if (!this.formationBees[i])
          this.wish({
            setup: this.setup[i],
            priority: this.priority,
          });
      }
    } else if (_.some(this.bees, (b) => b.state === beeStates.boosting))
      this.checkup();

    for (let i = 0; i < this.formationBees.length; ++i) {
      const bee = this.formationBees[i];
      if (bee && !Object.keys(this.bees).includes(bee.ref))
        this.formationBees[i] = undefined;
    }

    if (!this.formationBees[0])
      for (let i = 1; i < this.setup.length; ++i) {
        const bee = this.formationBees[i];
        if (!bee) continue;
        if (this.setup[0].name === this.setup[i].name) {
          this.formationBees[0] = bee;
          this.formationBees[i] = undefined;
          break;
        }
      }
  }

  public validFormation() {
    for (let i = 0; i < this.setup.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const beePos = bee.pos;
      const desiredPos = this.getDeisredPos(i);
      if (!desiredPos || !beePos.equal(desiredPos)) return ERR_NOT_IN_RANGE;
    }
    return OK;
  }

  // #endregion Public Methods (10)

  // #region Protected Methods (1)

  protected checkup() {
    let ans = true;
    for (const setup of this.setup) {
      if (
        !this.checkMinerals(
          setup.getBody(this.hive.room.energyCapacityAvailable, 17).body
        )
      )
        ans = false;
    }
    return ans;
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (7)

  private canBeOutDmged(pos: RoomPosition, padding: number) {
    for (let i = 0; i < this.setup.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i, pos);
      if (!desiredPos) continue;
      const stats = Apiary.intel.getComplexStats(
        desiredPos,
        3 + padding,
        1 + padding
      ).current;
      const creepDmg = stats.dmgClose + stats.dmgRange;
      const towerDmg = Apiary.intel.getTowerAttack(desiredPos, 50);
      const beeStats = Apiary.intel.getStats(bee.creep);
      // let myStats = Apiary.intel.getComplexMyStats(desiredPos).current;
      const heal = this.stats.current.heal;
      const resistCanHold = beeStats.current.resist - towerDmg - creepDmg;
      if (
        towerDmg + creepDmg >
        heal + Math.min(resistCanHold, (heal * 0.7) / 0.3)
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

  private checkMinerals(body: BodyPartConstant[], coef = this.setup.length) {
    if (
      !this.hive.cells.lab ||
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
      if (amountNeeded && this.hive.getUsedCapacity(res) < amountNeeded) {
        addResDict(this.hive.mastersResTarget, res, amountNeeded);
        ans = false;
      }
    }
    return ans;
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
    enemy: Creep | Structure | PowerCreep | undefined | null,
    tempTarget: Enemy[]
  ) {
    const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 10);

    let moveTarget =
      this.formationCenter.getRoomRangeTo(this.pos) <= 1 &&
      (this.pos.roomName === this.formationCenter.roomName ||
        _.filter(
          Game.map.describeExits(this.formationCenter.roomName),
          (e) => e === this.pos.roomName
        ).length)
        ? this.pos
        : new RoomPosition(25, 25, this.info.ent);
    let opt = this.getPathArgs(bee.ref);
    let fatigue = 0;
    let padding = 0;

    const targetPosRoomState = Apiary.intel.getInfo(
      this.pos.roomName,
      Infinity
    );
    let freeToChill =
      this.pos.roomName === this.hive.roomName &&
      !targetPosRoomState.enemies.length;

    const ticksToEndSafeMode = targetPosRoomState.safeModeEndTime - Game.time;
    const isSkRaid =
      roomInfo.roomState === roomStates.SKfrontier ||
      roomInfo.roomState === roomStates.SKcentral;
    if (isSkRaid) padding = -1;

    // @todo wait untill all resources removed cause ppl steal :/
    const endOfRaid =
      isSkRaid &&
      !enemy &&
      roomInfo.safePlace &&
      !this.pos
        .findInRange(FIND_STRUCTURES, 3)
        .filter((s) => "store" in s && s.store.getUsedCapacity()).length;

    if (endOfRaid) {
      this.info.targetid = "";
      this.parent.setPosition(this.hive.rest);
      freeToChill = true;
    }

    if (ticksToEndSafeMode > bee.ticksToLive || freeToChill) {
      // || !siedge || siedge.towerDmgBreach * 0.3 > this.stats.max.heal
      // no more enemies go uboost / reCycle
      enemy = undefined;
      _.forEach(this.bees, (b) => this.recycleBee(b));
      this.formationCenter = bee.pos;
      return;
    } else if (ticksToEndSafeMode > 0)
      // wait for end of safe mode and rush in
      moveTarget = new RoomPosition(25, 25, this.info.ent);

    if (this.stuckSiedge > 10) {
      if (this.stuckSiedge > 15) padding = -1;
      if (this.stuckSiedge > 20) {
        opt = this.getPathArgs(bee.ref, true);
        ++this.stuckSiedge;
      }
      bee.stop();
      if (enemy) {
        const newEnemy =
          (this.stats.current.dism ||
            this.stats.current.dmgClose ||
            this.stuckSiedge > 40) &&
          Apiary.war.getEasyEnemy(bee.pos);
        if (newEnemy) {
          enemy = newEnemy;
          if (enemy.pos.isNearTo(bee)) this.stuckSiedge = 0;
        } else if (
          this.activeBees.filter((b) => b.pos.getRangeTo(enemy!) > 3).length
        )
          this.stuckSiedge++;
        else this.stuckSiedge = 12;
        if (this.stuckSiedge > 50) this.stuckSiedge = 0;
      }
    }

    if (enemy instanceof Structure && moveTarget.roomName === this.pos.roomName)
      this.parent.setPosition(moveTarget);

    if (
      enemy &&
      (roomInfo.roomState === roomStates.ownedByEnemy ||
        roomInfo.dangerlvlmax >= 8)
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
      moveTarget = enemy.pos;
      opt.movingTarget = true;
      opt.range = 1;
      if (notNearExit && bee.pos.getRangeTo(enemy) < 10) {
        let direction = bee.pos.getDirectionTo(enemy);
        if (this.stats.current.dism && this.stats.current.dmgRange) {
          const enemyCreepDmg = tempTarget.filter(
            (e) => e.dangerlvl >= 4 && e.type === enemyTypes.moving
          )[0];
          if (enemyCreepDmg)
            switch (bee.pos.getDirectionTo(enemyCreepDmg.object)) {
              case TOP:
                direction = BOTTOM;
                break;
              case TOP_RIGHT:
                direction = BOTTOM_LEFT;
                break;
              case RIGHT:
                direction = LEFT;
                break;
              case BOTTOM_RIGHT:
                direction = TOP_LEFT;
                break;
              case BOTTOM:
                direction = TOP;
                break;
              case BOTTOM_LEFT:
                direction = TOP_RIGHT;
                break;
              case LEFT:
                direction = RIGHT;
                break;
              case TOP_LEFT:
                direction = BOTTOM_RIGHT;
                break;
            }
        }
        const rotate: 0 | 1 | -1 = this.checkRotation(direction);
        if (rotate) {
          bee.invalidatePath();
          busy = this.rotate(rotate);
        }
      }
    }

    if (busy) {
      bee.goTo(this.formationCenter);
      return;
    }

    bee.goTo(moveTarget, opt);

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
      const targetRoom =
        bee.pos.roomName === this.pos.roomName || this.stuckSiedge < 25;

      if (this.canBeOutDmged(bee.pos, padding) && targetRoom) {
        opt = this.getPathArgs(bee.ref, true);
        const exit = bee.pos.findClosest(
          Game.rooms[bee.pos.roomName].find(FIND_EXIT)
        );
        // flee
        this.stuckSiedge++;
        bee.goTo(exit || this.pos, opt);
      } else if (
        bee.targetPosition &&
        this.canBeOutDmged(bee.targetPosition, padding)
      ) {
        this.stuckSiedge++;
        // stop in place
        if (targetRoom) bee.stop();
      } else if (
        roomInfo.roomState === roomStates.ownedByEnemy &&
        notNearExit
      ) {
        const formationBreak =
          bee.targetPosition &&
          this.getSquadMoveMentValue(bee.targetPosition, bee.ref, false) > 5;
        if (formationBreak) {
          // take a break
          let range = 2;
          if (this.stats.current.dism) range = 1;
          if (
            this.activeBees.filter((b) => this.pos.getRangeTo(b) <= range)
              .length
          )
            bee.stop();
        }
      }
    }

    let newCenter =
      bee.targetPosition && bee.targetPosition.isFree()
        ? bee.targetPosition
        : bee.pos;
    if (
      bee.pos.roomName === newCenter.roomName &&
      newCenter.enteranceToRoom &&
      bee.pos.enteranceToRoom
    )
      newCenter =
        bee.pos
          .getOpenPositions()
          .filter((p) => !p.enteranceToRoom)
          .sort((a, b) => bee.pos.getRangeTo(a) - bee.pos.getRangeTo(b))[0] ||
        newCenter;
    this.formationCenter = newCenter;
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

  private visualsSquad(centerBeeRef: string = "") {
    for (let i = 0; i < this.formationBees.length; ++i) {
      const bee = this.formationBees[i];
      if (!bee) continue;
      const desiredPos = this.getDeisredPos(i);
      if (!desiredPos) continue;
      const vis = Apiary.visuals;
      if (vis.objectBusy(desiredPos.roomName)) continue;
      const style: CircleStyle = {};
      if (this.formationBees[i] && bee.ref === centerBeeRef)
        style.fill = "#FF0000";
      new RoomVisual(desiredPos.roomName).circle(
        desiredPos.x,
        desiredPos.y,
        style
      );
    }
  }

  // #endregion Private Methods (7)
}
