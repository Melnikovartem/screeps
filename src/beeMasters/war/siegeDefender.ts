import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import type { DefenseCell } from "cells/base/defenseCell";
import type { BoostRequest } from "cells/stage1/laboratoryCell";
import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates, roomStates } from "static/enums";
import { addResDict } from "static/utils";

import type { MovePriority } from "../_Master";
import { Master } from "../_Master";

const rampFilter = (ss: Structure[]) =>
  ss.filter(
    (s) =>
      s.structureType === STRUCTURE_RAMPART &&
      (s as StructureRampart).my &&
      s.hits > 10000
  );
export const findRamp = (pos: RoomPosition) =>
  !!rampFilter(pos.lookFor(LOOK_STRUCTURES)).length;

// most basic of bitches a horde full of wasps
@profile
export class SiegeMaster extends Master<DefenseCell> {
  // #region Properties (4)

  private boostDefender = false;
  private patience: { [id: string]: number } = {};

  public override movePriority: MovePriority = 2;
  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    this.patience[bee.ref] = 0;
  };

  // #endregion Properties (4)

  // #region Public Accessors (2)

  public override get boosts(): BoostRequest[] {
    return [
      { type: "fatigue", lvl: 2 },
      { type: "fatigue", lvl: 1 },
      { type: "fatigue", lvl: 0 },
      { type: "attack", lvl: 2 },
      { type: "attack", lvl: 1 },
      { type: "attack", lvl: 1 },
      { type: "attack", lvl: 0 },
      { type: "damage", lvl: 2 },
      { type: "damage", lvl: 1 },
      { type: "damage", lvl: 0 },
    ];
  }

  public override get targetBeeCount(): number {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    this.preRunBoost();
    _.forEach(this.activeBees, (bee) => {
      // unboost old bees
      if (bee.ticksToLive <= 25 && bee.boosted) bee.state = beeStates.fflush;
      switch (bee.state) {
        case beeStates.fflush:
          this.recycleBee(bee);
          break;
        case beeStates.chill:
          if (this.hive.state !== hiveStates.battle) {
            bee.goRest(this.hive.rest);
            break;
          }
          bee.state = beeStates.work;
        // fall through
        case beeStates.work: {
          let pos;
          if (
            this.hive.state !== hiveStates.battle &&
            this.patience[bee.ref] > 40
          ) {
            bee.state = beeStates.chill;
            bee.target = undefined;
            break;
          }
          if (bee.target) {
            const parsed = /^(\w*)_(\d*)_(\d*)/.exec(bee.target)!;
            if (parsed) {
              const [, roomName, x, y] = parsed;
              pos = new RoomPosition(+x, +y, roomName);
            }
          }

          const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 20);
          let enemy: Structure | PowerCreep | Creep | undefined;
          if (!pos || pos.equal(this.parent)) {
            enemy = Apiary.intel.getEnemy(bee, 20);
            if (!enemy) return;

            if (enemy) {
              let ramps = rampFilter(enemy.pos.findInRange(FIND_STRUCTURES, 4));
              if (!ramps.length) {
                ramps = rampFilter(enemy.pos.findInRange(FIND_STRUCTURES, 15));
                if (!ramps.length) this.patience[bee.ref] = 15;
              }
              ramps = ramps.filter(
                (r) => r.pos.getRangeTo(this.hive.controller) > 1
              );
              ramps = ramps.filter(
                (r) =>
                  !this.activeBees.filter(
                    (b) => b.ref !== bee.ref && b.target === r.pos.to_str
                  ).length
              );
              if (ramps.length)
                pos = ramps.reduce((prev, curr) => {
                  let ans;
                  if (
                    curr.pos.getRangeTo(bee) <= 5 &&
                    prev.pos.getRangeTo(bee) <= 5
                  )
                    ans =
                      curr.pos.getRangeTo(
                        curr.pos.findClosest(
                          roomInfo.enemies.map((e) => e.object)
                        )!
                      ) -
                      prev.pos.getRangeTo(
                        prev.pos.findClosest(
                          roomInfo.enemies.map((e) => e.object)
                        )!
                      );
                  else
                    ans =
                      curr.pos.getRangeTo(enemy!) - prev.pos.getRangeTo(enemy!);
                  if (ans === 0)
                    ans =
                      curr.pos.getRangeTo(this.parent) -
                      prev.pos.getRangeTo(this.parent);
                  return ans < 0 ? curr : prev;
                }).pos;
            }
          }

          if (!pos) pos = this.parent.pos;
          else {
            if (bee.target !== pos.to_str) this.patience[bee.ref] = 0;
            bee.target = pos.to_str;
          }

          enemy = Apiary.intel.getEnemy(bee, 20);
          if (enemy)
            _.forEach(roomInfo.enemies, (e) => {
              if (!(e.object instanceof Creep)) return;
              if (!(enemy instanceof Creep)) {
                enemy = e.object;
                return;
              }
              if (e.object.pos.getRangeTo(bee) > 2) return;
              if (
                !e.object.pos.getPositionsInRange(1).filter((s) => findRamp(s))
                  .length
              )
                return;
              let ans =
                enemy.hitsMax - enemy.hits - (e.object.hitsMax - e.object.hits);
              if (ans === 0) {
                ans =
                  e.object.pos.getPositionsInRange(1).filter((s) => findRamp(s))
                    .length -
                  enemy.pos.getPositionsInRange(1).filter((s) => findRamp(s))
                    .length;
              }
              if (ans === 0) {
                const statsEnemy = Apiary.intel.getStats(enemy).max;
                const statsNewEnemy = Apiary.intel.getStats(e.object).max;
                ans = statsEnemy.heal - statsNewEnemy.heal;
              }
              if (ans === 0) ans = Math.random() - 0.5;
              if (ans < 0) enemy = e.object;
            });

          if (
            this.patience[bee.ref] > 20 &&
            enemy &&
            (pos.getRangeTo(enemy) >= 4 ||
              enemy.pos.getPositionsInRange(3).filter((p) => findRamp(p))
                .length)
          ) {
            if (pos.equal(bee) && enemy && bee.pos.getRangeTo(enemy) > 3)
              bee.goTo(this.parent.pos);
            bee.target = undefined;
          }

          if (enemy) {
            this.beeAct(bee, enemy, pos);
            if (
              bee.targetPosition &&
              bee.targetPosition.getRangeTo(enemy) > bee.pos.getRangeTo(enemy)
            ) {
              this.patience[bee.ref] = 0;
              bee.target = undefined;
            }
          } else {
            if (
              !(
                pos.isNearTo(bee) &&
                this.patience[bee.ref] === 0 &&
                bee.hits === bee.hitsMax
              )
            )
              bee.goTo(pos);
            ++this.patience[bee.ref];
          }
        }
      }
    });
  }

  public override update() {
    super.update();
    this.boostDefender = false;
    if (this.hive.phase < 1) return;
    const roomInfo = Apiary.intel.getInfo(this.hiveName, 10);
    let shouldSpawn = roomInfo.dangerlvlmax >= 6;
    if (!shouldSpawn)
      _.some(Game.map.describeExits(this.hiveName), (exit) => {
        if (!exit) return;
        const roomInfoExit = Apiary.intel.getInfo(exit, 50);
        if (
          roomInfoExit.dangerlvlmax >= 8 &&
          roomInfoExit.enemies.length > 2 &&
          roomInfoExit.roomState !== roomStates.SKfrontier &&
          roomInfoExit.roomState !== roomStates.corridor &&
          roomInfoExit.roomState !== roomStates.ownedByEnemy &&
          roomInfoExit.roomState !== roomStates.ownedByMe
        )
          shouldSpawn = true;
        return shouldSpawn;
      });
    this.movePriority = 5 as const;
    if (
      !shouldSpawn ||
      (this.hive.controller.safeMode && this.hive.controller.safeMode > 100)
    ) {
      if (this.waitingForBees) this.removeWishes();
      return;
    }
    const enemy = Apiary.intel.getEnemy(this.hive.pos, 20);
    if (enemy) this.parent.reposessFlag(this.hive.pos, enemy);
    const defSquad = Apiary.defenseSwarms[this.hiveName];
    if (
      defSquad &&
      enemy &&
      defSquad.loosingBattle(Apiary.intel.getComplexStats(enemy).current) > 0
    )
      return;
    this.boostDefender = true;
    if (
      this.hive.cells.lab &&
      this.hive.getUsedCapacity(BOOST_MINERAL.attack[2]) >= LAB_BOOST_MINERAL
    )
      _.forEach(this.bees, (b) => {
        if (!b.boosted && b.ticksToLive >= 600) b.state = beeStates.boosting;
      });
    this.movePriority = 1 as const;
    addResDict(this.hive.mastersResTarget, RESOURCE_ENERGY, 50000);
    addResDict(this.hive.mastersResTarget, BOOST_MINERAL.attack[2], 2000);

    if (this.checkBees(true, CREEP_LIFE_TIME - 75)) {
      const defender = setups.defender.destroyer.copy();
      /* if (roomInfo.dangerlvlmax >= 8)
        defender.fixed = Array(5).fill(TOUGH); */
      this.wish({
        setup: defender,
        priority: 1,
      });
    }
  }

  // #endregion Public Methods (2)

  // #region Private Methods (1)

  private beeAct(
    bee: Bee,
    target: Creep | Structure | PowerCreep,
    posToStay: RoomPosition
  ) {
    let action1;
    let action2;

    const opt: TravelToOptions = { maxRooms: 1 };
    const roomInfo = Apiary.intel.getInfo(this.hiveName, 10);
    if (roomInfo.dangerlvlmax >= 5) {
      opt.stuckValue = 10;
      opt.roomCallback = (roomName, matrix) => {
        if (roomName !== this.hiveName) return;
        const terrain = Game.map.getRoomTerrain(roomName);
        const enemies = Apiary.intel
          .getInfo(roomName, 20)
          .enemies.filter((e) => e.dangerlvl >= 4)
          .map((e) => e.object);
        _.forEach(enemies, (c) => {
          _.forEach(c.pos.getOpenPositions(true, 3), (p) => {
            if (findRamp(p)) return;
            const coef = terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 2 : 1;
            matrix.set(
              p.x,
              p.y,
              Math.max(
                matrix.get(p.x, p.y),
                (4 - p.getRangeTo(c)) * 0x20 * coef
              )
            );
          });
          matrix.set(c.pos.x, c.pos.y, 0xff);
        });
        return matrix;
      };
    }

    const allBeeStats = Apiary.intel.getStats(bee.creep);
    const beeStats = allBeeStats.current;

    let healingTarget: Creep | Bee | PowerCreep | undefined | null;
    if (bee.hits < bee.hitsMax) healingTarget = bee;

    if (beeStats.heal > 0 && !healingTarget)
      healingTarget = bee.pos.findClosest(
        _.filter(
          bee.pos.findInRange(FIND_MY_CREEPS, 3),
          (c) => c.hits < c.hitsMax
        )
      );

    const rangeToTarget = bee.pos.getRangeTo(target);
    if (rangeToTarget === 1) bee.attack(target, opt);

    let targetedRange = 1;
    const statsAll = Apiary.intel.getComplexStats(target, 4, 2);
    const stats = statsAll.current;
    if (target instanceof Creep) {
      if (stats.dmgClose > beeStats.heal) targetedRange = 3;
      if (stats.dmgRange > beeStats.heal) targetedRange = 5;
    }

    if (rangeToTarget < 5) bee.memory._trav.path = undefined;

    // we do not fear this enemy
    const onPosition = posToStay.equal(bee);
    if (action1 || action2) this.patience[bee.ref] = 0;
    else
      this.patience[bee.ref] +=
        rangeToTarget <= 3
          ? 1
          : bee.pos.x > 2 && bee.pos.x < 47 && bee.pos.y > 2 && bee.pos.y < 47
          ? 7
          : 4;
    const attackPower =
      this.parent.getDmgAtPos(target.pos) +
      (rangeToTarget > 1 ? beeStats.dmgClose : 0);
    const provoke =
      rangeToTarget <= 2 &&
      attackPower * 3 >
        Math.min(stats.resist, (stats.heal * 0.7) / 0.3) +
          stats.heal * 3 +
          stats.hits &&
      (beeStats.hits * 0.5 >
        (stats.dmgClose + stats.dmgRange) *
          (posToStay.getRangeTo(bee) > 1 ? 2 : 1) ||
        (onPosition &&
          rangeToTarget === 1 &&
          beeStats.hits * 0.9 > stats.dmgClose + stats.dmgRange));
    if (
      this.parent.isBreached ||
      (provoke &&
        beeStats.hits >= allBeeStats.max.hits * 0.85 &&
        findRamp(bee.pos)) ||
      stats.dmgClose + stats.dmgRange < 500
    ) {
      bee.goTo(target, opt);
      this.patience[bee.ref] = 0;
    } else if (
      !(
        posToStay.isNearTo(bee) &&
        this.patience[bee.ref] <= 1 &&
        beeStats.hits === allBeeStats.max.hits
      ) &&
      !onPosition &&
      !(
        rangeToTarget === 1 &&
        provoke &&
        bee.pos.getOpenPositions().filter((p) => findRamp(p)).length
      )
    )
      bee.goTo(posToStay, opt);

    if (!bee.targetPosition) bee.targetPosition = bee.pos;
    if (findRamp(bee.targetPosition)) return OK;

    // stats in position that bee wants to go
    const statsEnemy = Apiary.intel.getComplexStats(
      bee.targetPosition,
      4,
      2
    ).current;
    if (
      (statsEnemy.dmgClose + statsEnemy.dmgRange >= beeStats.hits * 0.4 &&
        rangeToTarget <= targetedRange - 2) ||
      (statsEnemy.dmgClose + statsEnemy.dmgRange >= beeStats.hits * 0.2 &&
        bee.targetPosition.getRangeTo(posToStay) > 1 &&
        this.parent.wasBreached(target.pos, bee.targetPosition))
    )
      if (findRamp(bee.pos)) bee.stop();
      else bee.flee(this.pos, opt);
    return OK;
  }

  // #endregion Private Methods (1)
}
