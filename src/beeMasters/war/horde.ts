import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import type { CreepBattleInfo } from "spiderSense/intel-creep";
import { beeStates, enemyTypes, hiveStates } from "static/enums";

import type { Boosts } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

const BOOST_LVL = 2;
const FORGET_ENEMY_ENT = 2;

export interface HordeInfo {
  // #region Properties (3)

  boosts: Boosts;
  maxPath: number;
  targetBeeCount: number;

  // #endregion Properties (3)
}

// most basic of bitches a horde full of wasps
@profile
export class HordeMaster extends SwarmMaster<HordeInfo> {
  // #region Properties (6)

  private _maxSpawns = 1;
  private enemiesAtEnterance: {
    [enemyId: Id<Creep | PowerCreep | Structure>]: {
      lastSeen: number;
      pos: RoomPosition;
    };
  } = {};

  public movePriority = 4 as 3 | 4;
  public recycle = true;
  public setup = setups.archer.copy();
  // 0 if no 1 - 2 - 3 for cycle
  public trio = 0;

  // #endregion Properties (6)

  // #region Constructors (1)

  public constructor(order: SwarmOrder<HordeInfo>) {
    super(order);
    this.init();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (6)

  public override get boosts() {
    return this.info.boosts;
  }

  public override set boosts(value) {
    this.info.boosts = value;
  }

  public get emergency() {
    return (
      this.hive.state !== hiveStates.battle ||
      this.pos.roomName === this.hiveName
    );
  }

  public get maxSpawns(): number {
    return this._maxSpawns;
  }

  public get targetBeeCount(): number {
    return this.info.targetBeeCount;
  }

  public set targetBeeCount(value) {
    this.info.targetBeeCount = value;
  }

  // #endregion Public Accessors (6)

  // #region Public Methods (7)

  public beeAct(bee: Bee, target: Creep | Structure | PowerCreep | undefined) {
    let action1;
    let action2;

    const opt: TravelToOptions = {};
    const beeStats = Apiary.intel.getStats(bee.creep).current;
    const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, Infinity);

    const rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    const anyDmg = beeStats.dmgClose + beeStats.dmgRange + beeStats.dism;

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
      let healingTarget: Creep | Bee | PowerCreep | null =
        bee.hits < bee.hitsMax ||
        (rangeToTarget <= 3 &&
          !this.activeBees.filter((b) => b.hits < b.hitsMax).length)
          ? bee
          : null;
      if (!healingTarget)
        healingTarget = bee.pos.findClosest(
          _.filter(
            bee.pos.findInRange(FIND_MY_CREEPS, 3),
            (c) => c.hits < c.hitsMax
          )
        );
      if (!healingTarget && roomInfo.dangerlvlmax >= 4 && rangeToTarget <= 5)
        healingTarget = this.activeBees.reduce((a, b) =>
          a.pos.getRangeTo(target!) < b.pos.getRangeTo(target!) ? a : b
        );
      if (!healingTarget && roomInfo.dangerlvlmax >= 4) healingTarget = bee;
      const rangeToHealingTarget = healingTarget
        ? bee.pos.getRangeTo(healingTarget)
        : Infinity;
      if (rangeToHealingTarget <= 1 && (!action1 || beeStats.heal > anyDmg)) {
        action1 = () => bee.heal(healingTarget!);
      } else if (
        rangeToHealingTarget <= 3 &&
        ((!action2 && !action1) || beeStats.heal > anyDmg)
      )
        action2 = () => bee.rangedHeal(healingTarget!);
    }
    if (action2) action2();
    if (action1) action1();

    let targetedRange = 1;
    let loosingBattle = 1;
    let attackRange = 2;
    if (target instanceof Creep) {
      const enemyInfo = Apiary.intel.getComplexStats(target).current;
      loosingBattle = this.loosingBattle(enemyInfo, bee.pos.roomName);

      if (beeStats.dmgClose) {
        attackRange = 2;
      } else if (beeStats.dmgRange) {
        if (enemyInfo.dmgClose)
          attackRange =
            loosingBattle < 0 && enemyInfo.dmgClose > beeStats.heal ? 5 : 3;
        else if (enemyInfo.dmgRange)
          attackRange = 3; // enemyInfo.dmgRange > beeStats.heal  ? 4 : 3
        else attackRange = 0;
      } else attackRange = 4;

      if (loosingBattle < 0)
        if (enemyInfo.dmgRange > beeStats.heal) targetedRange = 5;
        else targetedRange = 3;
      else targetedRange = attackRange;
    }

    if (loosingBattle >= 0 && (bee.hits > bee.hitsMax * 0.3 || !beeStats.heal))
      targetedRange -= 2;
    else if (loosingBattle < 0) targetedRange = Infinity;

    if (!target) return OK;

    if (!anyDmg && beeStats.heal && bee.pos.roomName === this.pos.roomName) {
      // healer help with attack
      const moveTarget = this.activeBees
        .filter(
          (b) => b.pos.roomName === this.pos.roomName && b.ref !== bee.ref
        )
        .reduce((a, b) => {
          const statsA = Apiary.intel.getStats(a.creep).max;
          const statsB = Apiary.intel.getStats(b.creep).max;
          // follow guy with attack
          let diff = statsA.dmgClose - statsB.dmgClose;
          if (!diff) diff = a.hitsMax - a.hits - (b.hitsMax - b.hits);
          if (!diff) diff = b.pos.getRangeTo(bee) - a.pos.getRangeTo(bee);
          if (!diff) diff = statsA.dmgRange - statsB.dmgRange;
          if (!diff) diff = b.pos.getRangeTo(target) - a.pos.getRangeTo(target);
          if (!diff) diff = a.hitsMax - b.hitsMax;
          return diff >= 0 ? a : b;
        });
      opt.movingTarget = true;
      if (moveTarget) bee.goTo(moveTarget, opt);
      return OK;
    }

    // are we too close
    const shouldFlee = rangeToTarget < targetedRange || !anyDmg;

    // can we get help from towers inside hive
    const hiveTowers =
      Apiary.hives[bee.pos.roomName] &&
      Object.keys(Apiary.hives[bee.pos.roomName].cells.defense.towers).length;
    // flee if no help or if dmged
    if (shouldFlee && (!hiveTowers || bee.hits < bee.hitsMax)) {
      bee.flee(this.pos, opt, true); // loosingBattle && bee.pos.getRoomRangeTo(this.hive) <= 2 ? this.hive :
      return ERR_BUSY;
    }

    // if losing find smaller creeps to bully
    if (loosingBattle <= 0 && bee.pos.roomName === this.pos.roomName) {
      const newEnemy = bee.pos.findClosest(
        roomInfo.enemies
          .filter((e) => {
            if (!(e.object instanceof Creep)) return false;
            const stats = Apiary.intel.getStats(e.object).max;
            return this.loosingBattle(stats, bee.pos.roomName) > 0;
          })
          .map((e) => e.object)
      );
      if (newEnemy) {
        bee.goTo(newEnemy, bee.getFleeOpt(opt));
        return OK;
      }
    }

    if (
      target.pos.roomName === this.pos.roomName &&
      loosingBattle >= 0 &&
      (target.pos.x >= 48 ||
        target.pos.y >= 48 ||
        target.pos.x <= 1 ||
        target.pos.y <= 1)
    )
      this.enemiesAtEnterance[target.id] = {
        lastSeen: Game.time,
        pos: target.pos,
      };

    // be a bully if healthy
    if (rangeToTarget > targetedRange && bee.hits > bee.hitsMax * 0.75) {
      if (target && target.pos.getRangeTo(bee) <= 3) opt.movingTarget = true;
      // if we are winning stay in room or just go to him
      bee.goTo(target, opt);

      if (
        bee.targetPosition?.enteranceToRoom &&
        bee.pos.roomName === this.pos.roomName
      ) {
        // try to stay in room if winning
        // ingore Creeps Cause enemy will move anyway
        let goPositions = bee.pos
          .getOpenPositions()
          .filter((p) => !p.enteranceToRoom && p.getRangeTo(bee) === 1);
        if (goPositions.length) {
          const noBees = goPositions.filter((p) => p.isFree(true));
          if (noBees.length) goPositions = noBees;
        }
        if (goPositions.length) {
          bee.goTo(goPositions[0]);
          return OK;
        }
      }
      // stay in same room if winning
      if (
        loosingBattle >= 0 &&
        bee.targetPosition &&
        bee.targetPosition.enteranceToRoom &&
        bee.pos.roomName === this.pos.roomName
      ) {
        let goPositions = bee.pos
          .getOpenPositions()
          .filter((p) => !p.enteranceToRoom && p.getRangeTo(bee) === 1);
        if (goPositions.length) {
          const noBees = goPositions.filter((p) => p.isFree(true));
          if (noBees.length) goPositions = noBees;
        }
        if (goPositions.length) bee.targetPosition = goPositions[0];
      }
    }
    // if (bee.targetPosition && this.roomName === bee.pos.roomName)
    // return ERR_BUSY; // help with deff i guess
    return OK;
  }

  public override defaultInfo(): HordeInfo {
    return {
      targetBeeCount: 1,
      maxPath: this.pos.getTimeForPath(this.hive),
      boosts: [],
    };
  }

  public getStats(roomName?: string) {
    const myStats: CreepBattleInfo = {
      dmgClose: 0,
      dmgRange: 0,
      dism: 0,
      heal: 0,
      hits: 0,
      resist: 0,
      move: 0,
    };

    _.forEach(this.activeBees, (b) => {
      if (
        roomName &&
        b.pos.roomName !== roomName &&
        b.pos.enteranceToRoom &&
        b.pos.enteranceToRoom.roomName !== roomName
      )
        return;
      const stats = Apiary.intel.getStats(b.creep);
      for (const statType in stats.current) {
        const type = statType as keyof CreepBattleInfo;
        myStats[type] += stats.current[type];
      }
    });
    return myStats;
  }

  public init() {
    if (this.ref.includes("keep")) this._maxSpawns = 30;
    if (!this.ref.includes("recycle")) this.recycle = false;

    if (this.ref.includes("boost"))
      this.boosts = [
        { type: "rangedAttack", lvl: BOOST_LVL },
        { type: "attack", lvl: BOOST_LVL },
        { type: "heal", lvl: BOOST_LVL },
        { type: "fatigue", lvl: BOOST_LVL },
        { type: "damage", lvl: BOOST_LVL },
        { type: "dismantle", lvl: 2 },
        { type: "dismantle", lvl: 1 },
        { type: "dismantle", lvl: 0 },
      ];
    // fast to produce trio to stabilize room
    if (this.ref.includes("trio")) {
      // more of a harass unit unless i rly try to code
      this._maxSpawns = Math.max(60, this.maxSpawns); // 20 trios : 64K energy : 24H harass on shard2
      this.trio = (this.parent.spawned % 3) + 1;
      this.targetBeeCount = 3;
    }
    if (this.ref.includes("dismantle")) this.setup = setups.dismantler.copy();
    else if (this.ref.includes("guard")) {
      this._maxSpawns = 5;
      this.setup.patternLimit = 12;
      this.setup.fixed = [HEAL, HEAL, HEAL];
    } else if (this.ref.includes("polar")) {
      this.boosts = [
        { type: "attack", lvl: 2 },
        { type: "damage", lvl: 2 },
      ];
      this.setup.patternLimit = 10;
      this.setup.pattern = [ATTACK];
      this.setup.fixed = [TOUGH, TOUGH, TOUGH].concat(Array(12).fill(HEAL));
      this._maxSpawns = 100;
    } else if (this.ref.includes("elc")) {
      this.targetBeeCount = 1;
      this._maxSpawns = 20;
      this.setup.pattern = [RANGED_ATTACK];
      this.setup.fixed = Array(17).fill(HEAL) as BodyPartConstant[];
    } else if (this.ref.includes("6g3y_1")) {
      this.boosts = [
        { type: "rangedAttack", lvl: 2 },
        { type: "attack", lvl: 2 },
        { type: "heal", lvl: 2 },
        { type: "fatigue", lvl: 2 },
        { type: "damage", lvl: 2 },
      ];
      this.targetBeeCount = 2;
      this._maxSpawns = 10;
      this.setup.pattern = [ATTACK];
      // this.setup.patternLimit = 30;
      this.setup.fixed = Array(5)
        .fill(TOUGH)
        .concat(Array(10).fill(HEAL)) as BodyPartConstant[];
    } else if (this.ref.includes("6g3y")) {
      this.boosts = [
        { type: "rangedAttack", lvl: 2 },
        { type: "attack", lvl: 2 },
        { type: "heal", lvl: 2 },
        { type: "fatigue", lvl: 2 },
        { type: "damage", lvl: 2 },
      ];
      this.targetBeeCount = 2;
      this._maxSpawns = 100;
      // this.setup.patternLimit = 30;
      this.setup.fixed = [
        TOUGH,
        TOUGH,
        TOUGH,
        TOUGH,
        HEAL,
        HEAL,
        HEAL,
        HEAL,
        HEAL,
        HEAL,
        HEAL,
        HEAL,
      ];
    } else if (this.boosts.length && !this.ref.includes("full")) {
      this.setup.patternLimit = 15;
      this.setup.fixed = [TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL];
    } else if (this.boosts.length) {
      this.setup.fixed = Array(6)
        .fill(TOUGH)
        .concat(Array(6).fill(HEAL)) as BodyPartConstant[];
    }
  }

  public loosingBattle(
    enemyInfo: CreepBattleInfo,
    roomName?: string,
    myInfo = this.getStats(roomName)
  ) {
    let enemyTTK;
    let myTTK;
    myTTK =
      enemyInfo.hits /
      (myInfo.dmgClose +
        myInfo.dmgRange -
        Math.min(enemyInfo.resist, (enemyInfo.heal * 0.7) / 0.3) -
        enemyInfo.heal);

    if (myInfo.dmgRange && !enemyInfo.dmgRange) enemyTTK = Infinity;
    else {
      const enemyDmg =
        enemyInfo.dmgRange +
        (myInfo.dmgRange && !myInfo.dmgClose ? 0 : enemyInfo.dmgClose);
      enemyTTK =
        myInfo.hits /
        (enemyDmg -
          Math.min(myInfo.resist, (myInfo.heal * 0.7) / 0.3) -
          myInfo.heal);
    }

    if (enemyTTK < 0) enemyTTK = Infinity;
    if (myTTK < 0) myTTK = Infinity;
    if (enemyTTK === Infinity) return myTTK === Infinity ? 0 : 1; // draw
    if (enemyTTK < myTTK) return -1; // i am losing
    return 1; // i am wining
  }

  public run() {
    this.preRunBoost();

    _.forEach(this.activeBees, (bee) => {
      let enemy;
      switch (bee.state) {
        case beeStates.work: {
          let pos = bee.pos;
          if (
            bee.pos.roomName !== this.pos.roomName &&
            bee.pos.getRoomRangeTo(this.pos) <= 1
          )
            pos = this.pos;
          const beeStats = Apiary.intel.getStats(bee.creep).current;
          if (beeStats.dism) {
            const room = Game.rooms[this.pos.roomName];
            if (room) {
              const structures = _.compact(
                room
                  .find(FIND_FLAGS)
                  .filter(
                    (f) =>
                      f.color === COLOR_GREY &&
                      (f.secondaryColor === COLOR_RED ||
                        f.secondaryColor === COLOR_ORANGE)
                  )
                  .map((f) => f.pos.lookFor(LOOK_STRUCTURES)[0])
              );
              const noStore = structures.filter((s) => !("store" in s));
              enemy = noStore[0] || structures[0];
            }
            if (!enemy) enemy = Apiary.intel.getEnemyStructure(pos, 50);
          } else {
            const nearExit =
              bee.pos.x <= 3 ||
              bee.pos.x >= 47 ||
              bee.pos.y <= 3 ||
              bee.pos.y >= 47;
            enemy = Apiary.intel.getEnemy(pos, nearExit ? 0 : 10);
          }

          if (enemy) this.beeAct(bee, enemy);
          else {
            const healingTarget =
              bee.getActiveBodyParts(HEAL) &&
              this.activeBees.filter(
                (b) => b.hits < b.hitsMax && b.pos.getRangeTo(bee) <= 2
              )[0];
            if (healingTarget) bee.heal(healingTarget);
            else {
              // @todo finish dying creeps off
              const restTarget = !Object.keys(this.enemiesAtEnterance).length
                ? this.pos // no enemy go chill @ pos
                : _.reduce(
                    this.enemiesAtEnterance,
                    (prev: { pos: RoomPosition }, curr) =>
                      prev.pos.getRangeTo(bee) < curr.pos.getRangeTo(bee)
                        ? prev
                        : curr
                  ).pos; // wait for enemy
              bee.goRest(restTarget);
            }
          }
          if (
            !this.recycle ||
            enemy ||
            !bee.boosted ||
            bee.ticksToLive > this.info.maxPath
          )
            break;
          // if no enemies we go unboost
          bee.state = beeStates.fflush;
          // fall through
        }
        case beeStates.fflush:
          this.recycleBee(bee);
          if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
            bee.heal(bee);
          this.checkFlee(bee);
          break;
        case beeStates.chill: {
          enemy = Apiary.intel.getEnemy(bee.pos, 20);
          let ans: number = OK;
          if (enemy) {
            enemy = Apiary.intel.getEnemy(bee.pos, 20);
            if (enemy && bee.pos.getRangeTo(enemy) > 3) enemy = undefined;
          }
          ans = this.beeAct(bee, enemy);
          if (bee.pos.roomName === this.pos.roomName)
            bee.state = beeStates.work;
          if (ans === OK) {
            const opt = this.hive.opt;
            opt.useFindRoute = true;
            bee.goTo(this.pos, opt);
            if (bee.hits < bee.hitsMax && bee.getActiveBodyParts(HEAL))
              bee.heal(bee);
          }
        }
      }
    });
  }

  public override update() {
    super.update();

    for (const [enemyId, info] of Object.entries(this.enemiesAtEnterance))
      if (Game.time - info.lastSeen > FORGET_ENEMY_ENT)
        delete this.enemiesAtEnterance[enemyId as Id<Creep>];

    const roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    if (
      this.checkBees(
        this.emergency,
        CREEP_LIFE_TIME - this.info.maxPath - 10
      ) &&
      Game.time >=
        roomInfo.safeModeEndTime -
          300 -
          this.hive.pos.getRoomRangeTo(this.pos) * 50
    ) {
      if (this.trio) {
        // lost one replace a full setup
        // prob not best cost wise
        for (let i = this.trio; i < 4; ++i) {
          let setup;
          switch (this.trio) {
            case 1:
              setup = setups.archer.copy();
              setup.patternLimit = 3;
              setup.fixed = []; // ranged * 200 : 600
              break;
            case 2:
              setup = setups.knight.copy();
              setup.patternLimit = 10;
              setup.fixed = []; // mele * 130 : 1300
              setup.scheme = 2;
              break;
            case 3:
              setup = setups.healer.copy();
              setup.patternLimit = 3;
              setup.fixed = []; // heal * 300 : 900
              break;
            default:
              setup = this.setup.copy();
              setup.patternLimit = 2;
              setup.fixed = [HEAL];
          }
          this.wish({
            setup,
            priority: 4,
          });
          this.trio += this.trio === 3 ? -2 : 1; // cycle 1 - 2 - 3 - 1 - 2 -...
        }
      } else
        this.wish({
          setup: this.setup,
          priority: 4,
        });
    }
  }

  // #endregion Public Methods (7)
}
