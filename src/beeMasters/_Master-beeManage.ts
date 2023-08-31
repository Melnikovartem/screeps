import { Bee } from "bees/bee";
import { SpawnOrder } from "hive/hive";
import { ERR_INVALID_ACTION } from "static/constants";
import { beeStates, hiveStates } from "static/enums";

import { Master } from "./_Master";

export function newBee(master: Master, bee: Bee) {
  bee.memory.refMaster = master.ref;
  if (bee.state === beeStates.idle)
    bee.state =
      master.boosts && master.hive.cells.lab && bee.ticksToLive > 1200
        ? beeStates.boosting
        : beeStates.chill;
  master.bees[bee.ref] = bee;
  if (master.waitingForBees) master.waitingForBees -= 1;

  ++master.beesAmount;
  master.oldestSpawn = _.reduce(master.bees, (prev: Bee, curr) =>
    curr.creep.memory.born < prev.creep.memory.born ? curr : prev
  ).creep.memory.born;
}

export function deleteBee(master: Master, ref: string) {
  delete master.bees[ref];
  delete master.stcukEnterance[ref];
  for (let i = 0; i < master.activeBees.length; ++i)
    if (master.activeBees[i].ref === ref) {
      master.activeBees.splice(i, 1);
      --i;
    }
  master.beesAmount = Object.keys(master.bees).length;
  if (master.beesAmount)
    master.oldestSpawn = _.reduce(master.bees, (prev: Bee, curr) =>
      curr.creep.memory.born < prev.creep.memory.born ? curr : prev
    ).creep.memory.born;
}

export function removeBee(this: Master, bee: Bee) {
  bee.master = undefined;
  bee.memory.refMaster = "";
  bee.state = beeStates.chill;
  this.deleteBee(bee.ref);
}

export function checkBees(
  master: Master,
  spawnExtreme: boolean = false,
  spawnCycle: number = CREEP_LIFE_TIME - 10
): boolean {
  // in 4 ifs to be able to read...
  if (master.waitingForBees || master.targetBeeCount === 0) return false;
  if (!spawnExtreme && master.hive.state !== hiveStates.economy) return false;
  if (
    (master.hive.bassboost || master.hive).cells.defense.timeToLand <
    spawnCycle / 2
  )
    return false;
  return (
    master.targetBeeCount > master.beesAmount ||
    (master.beesAmount === master.targetBeeCount &&
      Game.time >= master.oldestSpawn + spawnCycle)
  );
}

export function wish(
  this: Master,
  template: { setup: SpawnOrder["setup"]; priority: SpawnOrder["priority"] },
  ref: string = this.ref
) {
  const order: SpawnOrder = {
    setup: template.setup.copy(),
    priority: template.priority,
    master: this.ref,
    ref,
    createTime: Game.time,
  };
  if (this.hive.bassboost) {
    let localBodyMax = 0;
    if (this.hive.state !== hiveStates.nospawn) {
      if (order.priority > 0)
        localBodyMax = order.setup.getBody(
          this.hive.room.energyCapacityAvailable
        ).body.length;
      else
        localBodyMax = order.setup.getBody(this.hive.room.energyAvailable).body
          .length;
    }
    if (
      localBodyMax >=
      order.setup.getBody(this.hive.bassboost.room.energyCapacityAvailable).body
        .length
    ) {
      this.hive.spawOrders[ref] = order;
      this.waitingForBees += 1;
    } else if (this.hive.bassboost.state === hiveStates.economy) {
      order.priority = order.priority ? 9 : 5; // default order priority
      this.hive.bassboost.spawOrders[ref] = order;
      this.waitingForBees += 1;
    }
  } else {
    this.hive.spawOrders[ref] = order;
    this.waitingForBees += 1;
  }
  // well he placed an order now just need to catch a creep after a spawn
}

/** get resources from creep before death
 * @param endCycle there are nothing for bee to do so it may die. default is true
 */
export function recycleBee(
  this: Master,
  bee: Bee,
  opt?: TravelToOptions,
  endCycle: boolean = true
) {
  let ans;
  if (bee.boosted) {
    ans = this.hive.cells.lab && this.hive.cells.lab.unboostBee(bee, opt);
    if (ans === OK || ans === ERR_NOT_IN_RANGE || ans === ERR_BUSY)
      return ERR_BUSY;
  }
  if (!endCycle) ans = this.hive.cells.spawn.recycleBee(bee, opt);
  if (ans === ERR_INVALID_ACTION || ans === ERR_NOT_FOUND) return OK;
  return ERR_BUSY;
}
