import { Master } from "../_Master";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { DefenseCell } from "../../cells/base/defenseCell";

const rampFilter = (ss: Structure[]) => ss.filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 10000)
const findRamp = (pos: RoomPosition) => !!rampFilter(pos.lookFor(LOOK_STRUCTURES)).length;


const DEFENDER = setups.defender.destroyer.copy();
DEFENDER.fixed = [TOUGH, TOUGH, TOUGH, TOUGH];

// most basic of bitches a horde full of wasps
@profile
export class SiegeMaster extends Master {
  boosts: Boosts | undefined = [{ type: "fatigue", lvl: 1 }, { type: "fatigue", lvl: 0 },
  { type: "attack", lvl: 2 }, { type: "attack", lvl: 1 }, { type: "attack", lvl: 0 },
  { type: "damage", lvl: 1 }, { type: "damage", lvl: 0 }];
  cell: DefenseCell;
  patience: { [id: string]: number } = {};

  constructor(defenseCell: DefenseCell) {
    super(defenseCell.hive, defenseCell.ref);
    this.cell = defenseCell;
  }

  update() {
    super.update();
    if (this.hive.state !== hiveStates.battle) {
      this.movePriority = <5>5;
      return;
    }
    this.movePriority = <1>1;
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (roomInfo.dangerlvlmax < 5)
      return;
    this.hive.add(this.hive.mastersResTarget, RESOURCE_ENERGY, 100000);
    if (this.checkBees(true)) {
      this.wish({
        setup: DEFENDER,
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
      opts.roomCallback = (roomName, matrix) => {
        if (roomName !== this.hive.roomName)
          return;
        let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl >= 4).map(e => e.object);
        _.forEach(enemies, c => {
          _.forEach(c.pos.getOpenPositions(true, 3), p => !findRamp(p) && matrix.set(p.x, p.y, Math.max(matrix.get(p.x, p.y), (4 - p.getRangeTo(c)) * 0x40)));
          matrix.set(c.pos.x, c.pos.y, 0xff);
        });
        return matrix;
      }
    }

    let beeStats = Apiary.intel.getStats(bee.creep).current;

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
    if (target instanceof Creep) {
      let info = Apiary.intel.getComplexStats(target).current;
      if (info.dmgClose > beeStats.heal)
        targetedRange = 3;
      if (info.dmgRange > beeStats.heal)
        targetedRange = 5;
    }

    if (rangeToTarget < 5)
      bee.memory._trav = undefined;

    // we do not fear this enemy
    let onPosition = posToStay.equal(bee);
    if (action1 || action2)
      this.patience[bee.ref] = 0;
    else
      this.patience[bee.ref] += rangeToTarget <= 4 ? 1 : 3;
    let stats = Apiary.intel.getComplexStats(target).current;
    let attackPower = this.cell.getDmgAtPos(target.pos) + (rangeToTarget > 1 ? beeStats.dmgClose : 0);
    let provoke = rangeToTarget <= 2 && attackPower > stats.resist + stats.heal && stats.dmgClose + stats.dmgRange < beeStats.hits * 0.9;
    if (provoke && onPosition && bee.hits >= bee.hitsMax * 0.8 && findRamp(bee.pos))
      bee.targetPosition = bee.pos.getPosInDirection(bee.pos.getDirectionTo(target));

    if (!(this.patience[bee.ref] === 0 && posToStay.isNearTo(bee)) && !onPosition && !(rangeToTarget === 1 && provoke && bee.pos.getOpenPositions(true).filter(p => findRamp(p)).length))
      bee.goTo(posToStay, opts);
    if (this.cell.isBreached)
      bee.goTo(target);
    if (!bee.targetPosition)
      bee.targetPosition = bee.pos;
    if (!findRamp(bee.targetPosition) && bee.targetPosition.getRangeTo(target) <= targetedRange - 2) {
      let stats = Apiary.intel.getComplexStats(bee.targetPosition).current;
      if (stats.dmgClose + stats.dmgRange >= beeStats.hits * 0.9 || stats.dmgClose + stats.dmgRange >= beeStats.hits * 0.5 && !findRamp(bee.pos))
        bee.flee(target, this.cell.pos, opts);
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
          if (this.hive.state !== hiveStates.battle && this.patience[bee.ref] > 50) {
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
          if (!pos) {
            let enemy = Apiary.intel.getEnemyCreep(this.cell.pos);
            if (enemy) {
              let ramps = rampFilter(enemy.pos.findInRange(FIND_STRUCTURES, 3));
              if (ramps.length)
                pos = ramps.reduce((prev, curr) => {
                  let ans = curr.pos.getRangeTo(enemy!) - prev.pos.getRangeTo(enemy!)
                  if (ans === 0)
                    ans = curr.pos.getRangeTo(this.cell) - prev.pos.getRangeTo(this.cell);
                  return ans < 0 ? curr : prev;
                }).pos;
            }
          }

          if (!pos)
            pos = this.cell.pos;
          else
            bee.target = pos.to_str;

          let enemy = Apiary.intel.getEnemyCreep(pos);

          if (this.patience[bee.ref] > 20) {
            if (pos.equal(bee))
              bee.goTo(this.cell.pos);
            bee.target = undefined;
          }

          if (enemy) {
            this.beeAct(bee, enemy, pos);
            if (!bee.targetPosition)
              bee.targetPosition = pos;
          } else {
            ++this.patience[bee.ref]
            bee.goTo(pos);
          }
      }
    });
  }
}
