import { Master } from "../_Master";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Boosts } from "../_Master";
import type { DefenseCell } from "../../cells/base/defenseCell";

const findRamp = (pos: RoomPosition) => !!pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my).length;

// most basic of bitches a horde full of wasps
@profile
export class SiegeMaster extends Master {
  movePriority = <1>1;
  boosts: Boosts | undefined = [{ type: "attack" }, { type: "heal" }, { type: "fatigue" }, { type: "damage" }];
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
        priority: 0,
      });
    }
  }

  attackOrFlee(bee: Bee, target: Creep | Structure | PowerCreep, spotToFlee: RoomPosition) {
    let action;
    let range = 3;
    if (bee.getActiveBodyParts(RANGED_ATTACK))
      action = () => bee.rangedAttack(target)
    if (bee.getActiveBodyParts(ATTACK)) {
      if (action)
        action = () => bee.attack(target) && bee.rangedAttack(target);
      else
        action = () => bee.attack(target);
      range = 1;
    }

    if (action)
      if (bee.pos.getRangeTo(target) <= range) {
        action();
      } else if (bee.hits === bee.hitsMax || !bee.getActiveBodyParts(HEAL)) {
        action();
        if (range === bee.pos.getRangeTo(target))
          bee.goTo(target);
      }

    if (findRamp(bee.pos) || (bee.targetPosition && findRamp(bee.targetPosition)))
      return OK;

    let targetRange = 1;
    let shouldFlee = !action;
    if (!shouldFlee && target instanceof Creep) {
      let info = Apiary.intel.getStats(target).current;
      if (info.dmgRange) {
        targetRange = 3;
        if (!info.dmgClose && bee.hits >= bee.hitsMax * 0.8)
          range = 2;
      } else if (info.dmgClose)
        targetRange = 1;
      else
        targetRange = 0;
      shouldFlee = targetRange > 0;
    }
    if (shouldFlee && (bee.pos.getRangeTo(target) <= targetRange && bee.hits <= bee.hitsMax * 0.9 || bee.pos.getRangeTo(target) < range))
      bee.flee(target, spotToFlee);
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

          }
          bee.state = beeStates.work;
        case beeStates.work:
          let pos;
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
              let ramps = enemy.pos.findInRange(FIND_STRUCTURES, 3).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my);
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

          if (enemy && pos.getRangeTo(enemy) <= 2) {
            this.attackOrFlee(bee, enemy, pos);
            this.patience = 0;
          } else if (this.patience > 20) {
            bee.goTo(this.cell.pos);
            bee.target = undefined;
          } else {
            ++this.patience;
            bee.goTo(pos);
          }
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
