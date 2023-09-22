import type { ProtoBee } from "bees/protoBee";
import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { beeStates, roomStates } from "static/enums";
import { addResDict } from "static/utils";

import type { Master, MasterParent } from "./_Master";

const FLEE_INTEL_LAG = 30;

export function preRunBoost(this: Master<MasterParent>) {
  _.forEach(this.bees, (bee) => {
    if (bee.state === beeStates.boosting)
      if (!this.hive.cells.lab || this.hive.cells.lab.boostBee(bee) === OK)
        bee.state = beeStates.chill;
  });
}

export function secureBoostsHive(this: Master<MasterParent>) {
  if (!this.boosts.length) return;
  const futureBees = Math.max(
    0,
    this.targetBeeCount - (this.beesAmount + this.waitingForBees)
  );
  const wantBoostRn = _.filter(
    this.bees,
    (b) => b.state === beeStates.boosting
  ).length;
  // we do not count bees that don't want to bee boosted but any future bees should have boosts
  const amountToSecure = this.waitingForBees + wantBoostRn + futureBees;
  if (amountToSecure < 0) return;
  _.forEach(this.boosts, (boost) =>
    addResDict(
      this.hive.mastersResTarget,
      BOOST_MINERAL[boost.type][boost.lvl],
      35 * amountToSecure * LAB_BOOST_MINERAL // wont use all, but better then cal for each bee (?or not?)
    )
  );
  // 35 is not best number, but it is ok for what it is worth
}

export function checkFlee(
  this: Master<MasterParent>,
  bee: ProtoBee<Creep | PowerCreep>, // who looks if fleeing is needed
  fleePos?: { pos: RoomPosition }, // where to flee
  opt?: TravelToOptions, // custom opt
  stop: boolean = true, // can stop or just run run run
  lag = FLEE_INTEL_LAG
) {
  let pos = bee.pos;

  if (bee.targetPosition)
    pos =
      (bee.targetPosition.roomName === pos.roomName &&
        bee.targetPosition.enteranceToRoom) ||
      bee.targetPosition;
  const roomInfo = Apiary.intel.getInfo(pos.roomName, lag);
  if (
    pos.roomName !== bee.pos.roomName &&
    !roomInfo.safePlace &&
    Apiary.intel.somewhatFreshInfo(pos.roomName) &&
    stop
  ) {
    const hive = Apiary.hives[pos.roomName];
    if (!hive || hive.cells.defense.isBreached) {
      if (bee.pos.enteranceToRoom)
        bee.flee((fleePos && fleePos.pos) || bee.movePosition || this.hive.pos);
      else {
        bee.stop();
        bee.targetPosition = bee.pos;
        if (bee.movePosition && bee.movePosition.roomName !== pos.roomName) {
          if (!this.stcukEnterance[bee.ref]) this.stcukEnterance[bee.ref] = 0;
          ++this.stcukEnterance[bee.ref]!;
          if (this.stcukEnterance[bee.ref]! > 20) {
            bee.invalidatePath();
            this.stcukEnterance[bee.ref] = undefined;
          }
        }
      }
    }
    return true;
  }

  const enemies = roomInfo.enemies
    .filter((e) => {
      if (!(e.object instanceof Creep)) return false;
      const stats = Apiary.intel.getStats(e.object).current;
      return !!(stats.dmgClose + stats.dmgRange);
    })
    .map((e) => e.object) as Creep[];
  const enemy = bee.pos.findClosest(enemies);
  if (!enemy) return false;
  if (
    roomInfo.roomState !== roomStates.ownedByMe ||
    roomInfo.safeModeEndTime < Game.time
  ) {
    const fleeDist = Apiary.intel.getFleeDist(enemy);
    const fleeTo = (fleePos && fleePos.pos) || bee.movePosition || null;
    if (
      ((enemy.pos.getRangeTo(pos) === fleeDist + 1 &&
        enemy.pos.getRangeTo(bee) > fleeDist) ||
        (fleeTo &&
          enemy.pos.getRangeTo(fleeTo) < bee.pos.getRangeTo(fleeTo) &&
          enemy.pos.getRangeTo(fleeTo) <= fleeDist)) && // we don't want to be coming closer to enemy
      stop
    ) {
      bee.stop();
      bee.targetPosition = bee.pos;
    } else if (
      enemy.pos.getRangeTo(pos) <= fleeDist ||
      enemy.pos.getRangeTo(bee.pos) <= fleeDist
    ) {
      bee.flee(fleeTo, opt);
      return true;
    }
  }
  return false;
}
