import type { WarcrimesModule } from "abstract/warModule";
import type { Bee } from "bees/bee";
import { CreepSetup } from "bees/creepSetups";
import { BOOST_MINERAL, BOOST_PARTS } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { SQUAD_VISUALS } from "settings";
import type {
  CreepAllBattleInfo,
  CreepBattleInfo,
  Enemy,
} from "spiderSense/intelligence";
import { beeStates, enemyTypes, hiveStates, roomStates } from "static/enums";
import { addResDict } from "static/utils";

import type { Boosts } from "../_Master";
import { Master } from "../_Master";

export type FormationPositions = [Pos, CreepSetup][];

type SquadEnemy = Creep | PowerCreep | Structure | undefined | null;

@profile
export class SquadWarCrimesMaster extends Master {
  public formationBees: (Bee | undefined)[] = [];
  public refInfo: string;
  public parent: WarcrimesModule;

  public get boosts(): Boosts {
    return [
      { type: "fatigue", lvl: 2 },
      { type: "rangedAttack", lvl: 2 },
      { type: "heal", lvl: 2 },
      { type: "damage", lvl: 2 },
      { type: "dismantle", lvl: 2 },
    ];
  }

  public constructor(
    parent: WarcrimesModule,
    info: {
      hive: string;
      setup: CreepSetup[];
      poss: Pos[];
      possEnt: Pos[];
      target: { x: number; y: number; roomName: string };
      ref: string;
      ent: string;
    }
  ) {
    super(Apiary.hives[info.hive], "siedge_" + info.ref);
    this.parent = parent;
    if (!Memory.cache.war.squadsInfo[info.ref])
      Memory.cache.war.squadsInfo[info.ref] = {
        seidgeStuck: 0,
        rotation: TOP,
        center:
          this.hive.state >= hiveStates.battle ? this.hive.pos : this.hive.rest,
        spawned: 0,
        targetid: "",
        lastUpdatedTarget: -1,
        ...info,
      };
    this.refInfo = info.ref;
  }

  public get info() {
    return Memory.cache.war.squadsInfo[this.refInfo];
  }

  public setupParsed?: CreepSetup[];

  public get setup(): CreepSetup[] {
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

  public get poss(): Pos[] {
    if (
      this.pos.x <= 2 ||
      this.pos.x >= 48 ||
      this.pos.y <= 2 ||
      this.pos.y >= 48
    )
      return this.info.possEnt;
    return this.info.poss;
  }

  public get stuckSiedge() {
    return this.info.seidgeStuck;
  }

  public set stuckSiedge(value) {
    this.info.seidgeStuck = value;
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

  public checkBees = () => {
    return (
      this.checkBeesSwarm() &&
      super.checkBees(this.emergency, CREEP_LIFE_TIME / 2)
    );
  };

  public checkBeesSwarm() {
    if (
      this.spawned >= this.maxSpawns &&
      !this.waitingForBees &&
      !this.beesAmount
    ) {
      this.delete();
      return false;
    }
    return this.spawned < this.maxSpawns;
  }

  public delete() {
    super.delete();
    delete this.parent.squads[this.refInfo];
    delete Memory.cache.war.squadsInfo[this.refInfo];
  }

  public set spawned(value) {
    this.info.spawned = value;
  }

  public get spawned() {
    return this.info.spawned;
  }

  public get pos() {
    const pos = this.info.target;
    return new RoomPosition(pos.x, pos.y, pos.roomName);
  }

  public set pos(value) {
    this.info.target = value;
  }

  public movePriority = 1 as const;
  public priority = 1 as const;
  public stuckValue = 0;

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

  public get maxSpawns() {
    return this.setup.length;
  }

  public set maxSpawns(_) {}

  public get targetBeeCount() {
    return this.setup.length;
  }

  public set targetBeeCount(_) {}

  public get enemy() {
    return Game.getObjectById(this.info.targetid);
  }

  public set enemy(value) {
    if (value) this.info.targetid = value.id;
  }

  public newBee = (bee: Bee) => {
    super.newBee(bee);
    for (let i = 0; i < this.setup.length; ++i)
      if (!this.formationBees[i] && bee.ref.includes(this.setup[i].name)) {
        this.formationBees[i] = bee;
        break;
      }
    if (
      bee.creep.memory.born + 1 === Game.time ||
      this.spawned < Object.keys(this.bees).length
    )
      ++this.spawned;
  };

  public update() {
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
      for (const i in stats.max) {
        this.stats.max[i as keyof CreepBattleInfo] +=
          stats.max[i as keyof CreepBattleInfo];
        this.stats.current[i as keyof CreepBattleInfo] +=
          stats.current[i as keyof CreepBattleInfo];
      }
    });
    if (this.checkBees() && this.checkup) {
      for (let i = 0; i < this.setup.length; ++i) {
        if (!this.formationBees[i])
          this.wish(
            {
              setup: this.setup[i],
              priority: this.priority,
            },
            this.ref + "_" + i
          );
      }
    } else if (_.some(this.bees, (b) => b.state === beeStates.boosting)) {
      this.checkup;
    }
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

  protected get checkup() {
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

  private checkMinerals(body: BodyPartConstant[], coef = this.setup.length) {
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

  public get emergency() {
    return (
      !!this.beesAmount ||
      (this.hive.state !== hiveStates.battle &&
        this.hive.state !== hiveStates.lowenergy)
    );
  }

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
      else if (!desiredPos.isFree(true))
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
      } else if (rangeToHealingTarget <= 3 && beeStats.heal > beeStats.dmgRange)
        action2 = () => bee.rangedHeal(healingTarget.bee!);
    }

    if (action1) action1();

    if (action2) action2();

    return OK;
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
    let padding = 1;

    const targetPosRoomState = Apiary.intel.getInfo(
      this.pos.roomName,
      Infinity
    );
    let freeToChill =
      this.pos.roomName === this.hive.roomName &&
      !targetPosRoomState.enemies.length;

    const ticksToEndSafeMode = targetPosRoomState.safeModeEndTime - Game.time;
    const endOfRaid =
      (roomInfo.roomState === roomStates.SKfrontier ||
        roomInfo.roomState === roomStates.SKcentral) &&
      !roomInfo.enemies.length;
    if (endOfRaid) {
      this.info.targetid = "";
      this.pos = this.hive.rest;
      freeToChill = true;
    }
    // let siedge = this.parent.siedge[this.pos.roomName];
    if (ticksToEndSafeMode > bee.ticksToLive || freeToChill) {
      // || !siedge || siedge.towerDmgBreach * 0.3 > this.stats.max.heal
      // no more enemies go chill / unboost
      enemy = undefined;
      const unboost =
        // bee.ticksToLive < 50 && // unboost as soon as you can
        this.hive.cells.lab &&
        this.hive.cells.lab.getUnboostLab(bee.ticksToLive);
      moveTarget = (unboost && unboost.pos) || this.hive.rest;
    } else if (ticksToEndSafeMode > 0)
      // wait for end of safe mode and rush in
      moveTarget = new RoomPosition(25, 25, this.info.ent);

    if (this.stuckSiedge > 10) {
      padding = this.stuckSiedge > 15 ? -1 : 0;
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
          this.parent.getEasyEnemy(bee.pos);
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
          bee.memory._trav.path = undefined;
          busy = this.rotate(rotate);
        }
      }
    }

    if (!busy) {
      bee.goTo(moveTarget, opt);
      if (moveTarget.roomName === this.pos.roomName) this.pos = moveTarget;
      if (
        moveTarget.getRangeTo(bee) <= 3 &&
        (!bee.targetPosition || bee.targetPosition.equal(bee.pos)) &&
        this.getSquadMoveMentValue(bee.pos, bee.ref, false) > 5
      ) {
        const poss = bee.pos.getOpenPositions(true);
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
        const rightRoom =
          bee.pos.roomName === this.pos.roomName || this.stuckSiedge < 25;
        if (this.canBeOutDmged(bee.pos, padding) && rightRoom) {
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
          if (rightRoom) bee.stop();
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
        bee.targetPosition && bee.targetPosition.isFree(true)
          ? bee.targetPosition
          : bee.pos;
      if (
        bee.pos.roomName === newCenter.roomName &&
        newCenter.enteranceToRoom &&
        bee.pos.enteranceToRoom
      )
        newCenter =
          bee.pos
            .getOpenPositions(true)
            .filter((p) => !p.enteranceToRoom)
            .sort((a, b) => bee.pos.getRangeTo(a) - bee.pos.getRangeTo(b))[0] ||
          newCenter;
      this.formationCenter = newCenter;
    } else bee.goTo(this.formationCenter);
  }

  private canValidate() {
    const terrain = Game.map.getRoomTerrain(this.formationCenter.roomName);
    const poss = this.desiredPoss;
    for (const desired of poss) {
      if (
        !desired.pos.isFree(true) ||
        desired.pos.enteranceToRoom ||
        terrain.get(desired.pos.x, desired.pos.y) === TERRAIN_MASK_SWAMP
      )
        return ERR_NO_PATH;
    }
    return OK;
  }

  private canBeOutDmged(pos: RoomPosition, padding = 1) {
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
      if (
        towerDmg + creepDmg >
        heal + Math.min(beeStats.current.resist, (heal * 0.7) / 0.3)
      )
        return true;
    }
    return false;
  }

  public run() {
    if (
      this.formationCenter.roomName === this.pos.roomName &&
      (!this.enemy || this.info.lastUpdatedTarget + 100 < Game.time)
    ) {
      if (
        this.stats.current.dmgClose +
          this.stats.current.dmgRange +
          this.stats.current.dism >
        0
      ) {
        const enemy = this.parent.getEnemy(
          this.info.lastUpdatedTarget === -1 ? this.pos : this.formationCenter,
          this.stats.current.dism > 0
        );
        if (enemy) {
          this.enemy = enemy;
          this.info.lastUpdatedTarget = Game.time;
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

    let readyToGo = this.spawned >= this.maxSpawns;
    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting) {
        if (
          !this.hive.cells.lab ||
          this.hive.cells.lab.askForBoost(bee, this.boosts) === OK
        )
          bee.state = beeStates.chill;
        else readyToGo = false;
      }
    });
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
      if (!desiredPos || !desiredPos.isFree(true)) {
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
}
