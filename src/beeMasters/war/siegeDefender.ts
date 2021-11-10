import { Master } from "../_Master";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates, roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { DefenseCell } from "../../cells/base/defenseCell";

const rampFilter = (ss: Structure[]) => ss.filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 10000)
export const findRamp = (pos: RoomPosition) => !!rampFilter(pos.lookFor(LOOK_STRUCTURES)).length;

// most basic of bitches a horde full of wasps
@profile
export class SiegeMaster extends Master {
  boosts: Boosts | undefined = [{ type: "fatigue", lvl: 2 }, { type: "fatigue", lvl: 1 }, { type: "fatigue", lvl: 0 },
  { type: "attack", lvl: 2 }, { type: "attack", lvl: 1 }, { type: "attack", lvl: 1 }, { type: "attack", lvl: 0 },
  { type: "damage", lvl: 2 }, { type: "damage", lvl: 1 }, { type: "damage", lvl: 0 }];
  cell: DefenseCell;
  patience: { [id: string]: number } = {};

  constructor(defenseCell: DefenseCell) {
    super(defenseCell.hive, defenseCell.ref);
    this.cell = defenseCell;
  }

  update() {
    super.update();
    if (this.hive.phase < 1)
      return;
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    let shouldSpawn = roomInfo.dangerlvlmax > 5;
    if (!shouldSpawn)
      _.some(Game.map.describeExits(this.hive.roomName), exit => {
        if (!exit)
          return;
        let roomInfoExit = Apiary.intel.getInfo(exit, 25);
        if (roomInfoExit.dangerlvlmax >= 8 && roomInfoExit.roomState !== roomStates.SKfrontier)
          shouldSpawn = true;
        return shouldSpawn;
      });
    this.movePriority = <5>5;
    if (!shouldSpawn || (this.hive.room.controller!.safeMode && this.hive.room.controller!.safeMode > 100)) {
      if (this.waitingForBees) {
        delete this.hive.spawOrders[this.ref];
        if (this.hive.bassboost)
          delete this.hive.bassboost.spawOrders[this.ref];
        this.waitingForBees = 0;
      }
      return;
    }
    this.movePriority = <1>1;
    this.hive.add(this.hive.mastersResTarget, RESOURCE_ENERGY, 50000);
    if (this.checkBees(true)) {
      let defender = setups.defender.destroyer.copy();
      /* if (roomInfo.dangerlvlmax >= 8)
        defender.fixed = Array(5).fill(TOUGH); */
      this.wish({
        setup: defender,
        priority: 1,
      });
    }
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.patience[bee.ref] = 0;
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep, posToStay: RoomPosition) {
    let action1;
    let action2;

    let opts: TravelToOptions = { maxRooms: 1 };
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (roomInfo.dangerlvlmax >= 5) {
      opts.stuckValue = 20;
      opts.roomCallback = (roomName, matrix) => {
        if (roomName !== this.hive.roomName)
          return;
        let terrain = Game.map.getRoomTerrain(roomName);
        let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl >= 4).map(e => e.object);
        _.forEach(enemies, c => {
          _.forEach(c.pos.getOpenPositions(true, 3), p => {
            if (findRamp(p))
              return;
            let coef = terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 2 : 1;
            matrix.set(p.x, p.y, Math.max(matrix.get(p.x, p.y), (4 - p.getRangeTo(c)) * 0x20 * coef))
          });
          matrix.set(c.pos.x, c.pos.y, 0xff);
        });
        return matrix;
      }
    }

    let allBeeStats = Apiary.intel.getStats(bee.creep);
    let beeStats = allBeeStats.current;

    let healingTarget: Creep | Bee | PowerCreep | undefined | null;
    if (bee.hits < bee.hitsMax)
      healingTarget = bee;

    if (beeStats.heal > 0 && !healingTarget)
      healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));

    let rangeToTarget = target ? bee.pos.getRangeTo(target) : Infinity;
    let rangeToHealingTarget = healingTarget ? bee.pos.getRangeTo(healingTarget) : Infinity;

    if (rangeToTarget <= 3 && beeStats.dmgRange > 0)
      action2 = () => bee.rangedAttack(target, opts);
    else if (rangeToHealingTarget > 1 && rangeToHealingTarget <= 3 && beeStats.heal > 0)
      action2 = () => bee.rangedHeal(healingTarget, opts);

    if (rangeToHealingTarget < 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget, opts);
    else if (rangeToTarget === 1 && beeStats.dmgClose > 0)
      action1 = () => bee.attack(target, opts);
    else if (rangeToHealingTarget === 1 && beeStats.heal > 0)
      action1 = () => bee.heal(healingTarget, opts);

    if (action1)
      action1();

    if (action2)
      action2();

    let targetedRange = 1;
    let statsAll = Apiary.intel.getComplexStats(target, 4, 2);
    let stats = statsAll.current;
    if (target instanceof Creep) {
      if (stats.dmgClose > beeStats.heal)
        targetedRange = 3;
      if (stats.dmgRange > beeStats.heal)
        targetedRange = 5;
    }

    if (rangeToTarget < 5)
      bee.memory._trav.path = undefined;

    // we do not fear this enemy
    let onPosition = posToStay.equal(bee);
    if (action1 || action2)
      this.patience[bee.ref] = 0;
    else
      this.patience[bee.ref] += rangeToTarget <= 4 ? 1 : (bee.pos.x > 2 && bee.pos.x < 47 && bee.pos.y > 2 && bee.pos.y < 47 ? 7 : 4);
    let attackPower = this.cell.getDmgAtPos(target.pos) + (rangeToTarget > 1 ? beeStats.dmgClose : 0);
    let provoke = (rangeToTarget <= 3 && stats.hits < statsAll.max.hits || rangeToTarget === 1) && attackPower > stats.resist + stats.heal
      && (beeStats.hits * 0.85 > (stats.dmgClose + stats.dmgRange) * 1.5
        || onPosition && rangeToTarget === 1 && beeStats.hits * 0.9 > (stats.dmgClose + stats.dmgRange));
    if ((this.cell.isBreached
      || (provoke && beeStats.hits >= allBeeStats.max.hits * 0.85 && findRamp(bee.pos))
      || !(stats.dmgClose + stats.dmgRange)) && posToStay.getRangeTo(bee) <= 3) {
      bee.goTo(target, opts);
      this.patience[bee.ref] = 0;
    } else if (!(posToStay.isNearTo(bee) && this.patience[bee.ref] <= 1 && beeStats.hits === allBeeStats.max.hits) &&
      !onPosition && !(rangeToTarget === 1 && provoke && bee.pos.getOpenPositions(true).filter(p => findRamp(p)).length))
      bee.goTo(posToStay, opts);

    if (!bee.targetPosition)
      bee.targetPosition = bee.pos;
    if (!findRamp(bee.targetPosition)) {
      let stats = Apiary.intel.getComplexStats(bee.targetPosition, 4, 2).current;
      if ((stats.dmgClose + stats.dmgRange >= beeStats.hits * 0.4 && rangeToTarget <= targetedRange - 2)
        || this.cell.wasBreached(target.pos, bee.targetPosition) && stats.dmgClose + stats.dmgRange >= beeStats.hits * 0.9)
        // || (stats.dmgClose + stats.dmgRange >= beeStats.hits * 0.3 && !(bee.targetPosition.getOpenPositions(true).filter(p => findRamp(p))).length))
        if (findRamp(bee.pos))
          bee.targetPosition = undefined;
        else
          bee.flee(this.cell.pos, opts);
    }
    return OK;
  }


  run() {
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting && (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK))
        bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      let old = bee.ticksToLive <= 25
      if (old && bee.boosted)
        bee.state = beeStates.fflush;
      switch (bee.state) {
        case beeStates.fflush:
          if (!this.hive.cells.lab || !bee.boosted) {
            bee.state = beeStates.work;
            break;
          }
          let lab = this.hive.cells.lab.getUnboostLab() || this.hive.cells.lab;
          bee.goRest(lab.pos);
          break;
        case beeStates.chill:
          if (this.hive.state !== hiveStates.battle) {
            bee.goRest(this.hive.rest);
            break;
          }
          bee.state = beeStates.work;
        case beeStates.work:
          let pos;
          if (this.hive.state !== hiveStates.battle && this.patience[bee.ref] > 40) {
            bee.state = beeStates.chill;
            bee.target = undefined;
            break;
          }
          if (bee.target) {
            let parsed = /^(\w*)_(\d*)_(\d*)/.exec(bee.target)!;
            if (parsed) {
              let [, roomName, x, y] = parsed;
              pos = new RoomPosition(+x, +y, roomName);
            }
          }
          if (!pos || pos.equal(this.cell)) {
            let enemy = Apiary.intel.getEnemy(bee);
            if (!enemy)
              return;

            if (enemy) {
              let ramps = rampFilter(enemy.pos.findInRange(FIND_STRUCTURES, 4));
              if (!ramps.length) {
                ramps = rampFilter(enemy.pos.findInRange(FIND_STRUCTURES, 15));
                if (ramps.length)
                  this.patience[bee.ref] = 15;
              }
              if (ramps.length)
                pos = ramps.reduce((prev, curr) => {
                  let ans = curr.pos.getRangeTo(enemy!) - prev.pos.getRangeTo(enemy!);
                  if (ans === 0)
                    ans = curr.pos.getRangeTo(this.cell) - prev.pos.getRangeTo(this.cell);
                  return ans < 0 ? curr : prev;
                }).pos;
            }
          }

          if (!pos)
            pos = this.cell.pos;
          else {
            if (bee.target !== pos.to_str)
              this.patience[bee.ref] = 0;
            bee.target = pos.to_str;
          }

          let enemy = Apiary.intel.getEnemy(bee.pos);

          if (this.patience[bee.ref] > 20 && enemy && (pos.getRangeTo(enemy) >= 4 || enemy.pos.getPositionsInRange(3).filter(p => findRamp(p)).length)) {
            if (pos.equal(bee) && enemy && bee.pos.getRangeTo(enemy) > 3)
              bee.goTo(this.cell.pos);
            bee.target = undefined;
          }

          if (enemy) {
            this.beeAct(bee, enemy, pos);
            if (bee.targetPosition && bee.targetPosition.getRangeTo(enemy) > bee.pos.getRangeTo(enemy)) {
              this.patience[bee.ref] = 0;
              bee.target = undefined;
            }
          } else {
            if (!(pos.isNearTo(bee) && this.patience[bee.ref] === 0 && bee.hits === bee.hitsMax))
              bee.goTo(pos);
            ++this.patience[bee.ref];
          }
      }
    });
  }
}
