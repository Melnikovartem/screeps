import type { Bee } from "bees/bee";
import type { SpawnOrder } from "hive/hive-declarations";
import { ERR_INVALID_ACTION } from "static/constants";
import { beeStates, hiveStates } from "static/enums";

import type { Master, MasterParent } from "./_Master";

const BEE_QUE_PER_MASTER = 3;

// some smartass (me) ovverrided next 3 functions down the road so we make them methods
// 1 overrided to add extra actions when catching bee
export function newBee(master: Master<MasterParent>, bee: Bee) {
  // link bee
  bee.master = master;
  // 0.2 cost is a no from me
  bee.memory.refMaster = master.ref;
  if (bee.state === beeStates.idle)
    bee.state =
      master.boosts.length && master.hive.cells.lab && bee.ticksToLive > 1200
        ? beeStates.boosting
        : beeStates.chill;
  master.bees[bee.ref] = bee;
  if (master.waitingForBees) master.waitingForBees -= 1;

  ++master.beesAmount;
  master.oldestSpawn = _.reduce(master.bees, (prev: Bee, curr) =>
    curr.memory.born < prev.memory.born ? curr : prev
  ).memory.born;
}
// 2 overrided to add extra actions when deleting bee
export function deleteBee(master: Master<MasterParent>, ref: string) {
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
      curr.memory.born < prev.memory.born ? curr : prev
    ).memory.born;
}
// 3 overrided for swarmOrder variant
export function checkBees(
  master: Master<MasterParent>,
  spawnWhenExtreme: boolean = false,
  spawnCycle: number = CREEP_LIFE_TIME - 10
): boolean {
  // in case we recalc something there
  const targetBeeCount = master.targetBeeCount;
  // in 4 ifs to be able to read...
  if (
    master.waitingForBees > BEE_QUE_PER_MASTER ||
    targetBeeCount === 0 ||
    spawnCycle < 0
  )
    return false;
  if (!spawnWhenExtreme && master.hive.state !== hiveStates.economy)
    return false;
  if (
    (master.hive.bassboost || master.hive).cells.defense.timeToLand <
    spawnCycle / 2
  )
    return false;
  const beesAmountFuture = master.beesAmount + master.waitingForBees;
  return (
    beesAmountFuture < targetBeeCount ||
    (beesAmountFuture === targetBeeCount &&
      master.oldestSpawn + spawnCycle <= Game.time &&
      !master.waitingForBees) // no more then one bee on cycle spawn que
  );
}

export function removeBee(this: Master<MasterParent>, bee: Bee) {
  bee.master = undefined;
  bee.memory.refMaster = "";
  bee.state = beeStates.chill;
  this.deleteBee(bee.ref);
}

// used to support chages before creep before it whent to production
export function wish(
  this: Master<MasterParent>,
  template: { setup: SpawnOrder["setup"]; priority: SpawnOrder["priority"] }
) {
  if (!this.checkBeforeWish) {
    console.log(`ERR @${this.print}: DIDNT USE CHECKBEES BEFORE SPAWN`);
    return;
  }
  const order: SpawnOrder = {
    setup: template.setup.copy(),
    priority: template.priority,
    master: this.ref,
    createTime: Game.time,
  };
  let hiveToSpawn = this.hive;
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
      localBodyMax <
        order.setup.getBody(this.hive.bassboost.room.energyCapacityAvailable)
          .body.length &&
      this.hive.bassboost.state === hiveStates.economy
    ) {
      order.priority = order.priority ? 9 : 5; // order priority when boosting (5 for essential / 9 for other)
      hiveToSpawn = this.hive.bassboost;
    }
  }
  hiveToSpawn.cells.spawn.spawnQue.push(order);
  this.waitingForBees += 1;
  // well he placed an order now just need to catch a creep after a spawn
}

/** get resources from creep before death
 * @param endCycle there are nothing for bee to do so it may die. default is true
 */
export function recycleBee(
  this: Master<MasterParent>,
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
  if (endCycle) ans = this.hive.cells.spawn.recycleBee(bee, opt);
  if (ans === ERR_INVALID_ACTION || ans === ERR_NOT_FOUND) return OK;
  return ERR_BUSY;
}
