import { ProtoBee } from "bees/protoBee";
import { beeStates, roomStates } from "static/enums";

import { Master } from "./_Master";

export function preRunBoost(this: Master) {
  _.forEach(this.bees, (bee) => {
    if (bee.state === beeStates.boosting)
      if (!this.hive.cells.lab || this.hive.cells.lab.boostBee(bee) === OK)
        bee.state = beeStates.chill;
  });
}

export function checkFlee(
  this: Master,
  bee: ProtoBee<Creep | PowerCreep>,
  fleePos?: { pos: RoomPosition },
  opt?: TravelToOptions,
  stop: boolean = true,
  lag = 30
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
    Game.time - roomInfo.lastUpdated <= 20 &&
    !roomInfo.safePlace &&
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
          if (this.stcukEnterance[bee.ref]! > 10 && bee.memory._trav) {
            bee.memory._trav.path = undefined;
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
