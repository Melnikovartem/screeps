import { Master } from "../_Master";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { DefenseCell } from "../../cells/base/defenseCell";

const findRamp = (pos: RoomPosition) => !!pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 1000).length;

// most basic of bitches a horde full of wasps
@profile
export class SiegeMaster extends Master {
  movePriority = <1>1;
  boosts: Boosts | undefined = [{ type: "attack", lvl: 2 }, { type: "attack", lvl: 1 }, { type: "attack", lvl: 0 }
    , { type: "fatigue", lvl: 0 }, { type: "fatigue", lvl: 1 }, { type: "fatigue", lvl: 2 }];
  cell: DefenseCell;
  patience = 0;

  constructor(defenseCell: DefenseCell) {
    super(defenseCell.hive, defenseCell.ref);
    this.cell = defenseCell;
  }

  update() {
    super.update();

    if (this.hive.state === hiveStates.battle && this.checkBees(true)) {
      this.wish({
        setup: setups.defender.siege,
        priority: 1,
      });
    }
  }

  beeAct(bee: Bee, target: Creep | Structure | PowerCreep, posToStay: RoomPosition) {
    let action1;
    let action2;

    let opts: TravelToOptions = { maxRooms: 1 };
    if (this.hive.state === hiveStates.battle) {
      opts.roomCallback = (roomName, matrix) => {
        if (roomName !== this.hive.roomName)
          return;
        let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl > 1).map(e => e.object);
        _.forEach(enemies, c => {
          _.forEach(c.pos.getOpenPositions(true, 3), p => matrix.set(p.x, p.y, Math.max(matrix.get(p.x, p.y), (4 - p.getRangeTo(c)) * 0x20)));
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

    // we do not fear this enemy

    if (action1 || action2)
      this.patience = 0;
    else
      ++this.patience;

    let underRamp = findRamp(bee.pos) || bee.targetPosition && findRamp(bee.targetPosition);
    if (!underRamp && bee.pos.getRangeTo(target) < targetedRange && bee.hits <= bee.hitsMax * 0.9)
      bee.flee(target, posToStay, opts);
    else
      bee.goTo(posToStay, opts);

    if (bee.targetPosition && !findRamp(bee.targetPosition)) {
      let stats = Apiary.intel.getComplexStats(bee.targetPosition).current;
      if (stats.dmgClose + stats.dmgRange > beeStats.hits / 2 && bee.targetPosition.getRangeTo(target) < bee.pos.getRangeTo(target))
        bee.flee(target, posToStay, opts);
    }
    return OK;
  }


  run() {
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting && (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK))
        bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      let enemy;
      switch (bee.state) {
        case beeStates.chill:
          if (this.hive.state !== hiveStates.battle) {
            bee.goRest(this.hive.rest);
            break;
          }
          bee.state = beeStates.work;
        case beeStates.work:
          let pos;
          if (this.hive.state !== hiveStates.battle) {
            bee.state = beeStates.chill;
            delete bee.target;
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
              let ramps = enemy.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 1000);
              if (!ramps.length)
                ramps = enemy.pos.findInRange(FIND_STRUCTURES, 3).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 1000);
              let ramp = this.cell.pos.findClosest(ramps);
              if (ramp)
                pos = ramp.pos;
            }
          }

          if (!pos || this.cell.isBreached)
            pos = this.cell.pos;
          else
            bee.target = pos.to_str;

          let enemy = Apiary.intel.getEnemyCreep(pos);

          if (this.patience > 20) {
            if (pos.x === bee.pos.x && pos.y === bee.pos.y && pos.roomName === bee.pos.roomName)
              bee.goTo(this.cell.pos);
            bee.target = undefined;
          }

          if (enemy) {
            this.beeAct(bee, enemy, pos);
            if (!bee.targetPosition)
              bee.targetPosition = pos;
          } else
            bee.goTo(pos);
      }

      if (bee.getActiveBodyParts(HEAL))
        if (bee.hits < bee.hitsMax)
          bee.heal(bee);
        else {
          let healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3), c => c.hits < c.hitsMax));
          if (healingTarget)
            if (healingTarget.pos.getRangeTo(bee) <= 1)
              bee.heal(healingTarget);
            else if (!enemy)
              bee.rangedHeal(healingTarget);
        }
    });
  }
}
