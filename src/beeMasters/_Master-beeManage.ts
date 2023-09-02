import type { Bee } from "bees/bee";
import type { SpawnOrder } from "hive/hive-declarations";
import { ERR_INVALID_ACTION } from "static/constants";
import { beeStates, hiveStates } from "static/enums";

import type { Master, MasterParent } from "./_Master";

const BEE_QUE_PER_MASTER = 3;

export function newBee(this: Master<MasterParent>, bee: Bee) {
  // 0.2 cost is a no from me
  // bee.creep.notifyWhenAttacked(this.notify);
  bee.memory.refMaster = this.ref;
  if (bee.state === beeStates.idle)
    bee.state =
      this.boosts && this.hive.cells.lab && bee.ticksToLive > 1200
        ? beeStates.boosting
        : beeStates.chill;
  this.bees[bee.ref] = bee;
  if (this.waitingForBees) this.waitingForBees -= 1;

  ++this.beesAmount;
  this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) =>
    curr.creep.memory.born < prev.creep.memory.born ? curr : prev
  ).creep.memory.born;
}

export function deleteBee(this: Master<MasterParent>, ref: string) {
  delete this.bees[ref];
  delete this.stcukEnterance[ref];
  for (let i = 0; i < this.activeBees.length; ++i)
    if (this.activeBees[i].ref === ref) {
      this.activeBees.splice(i, 1);
      --i;
    }
  this.beesAmount = Object.keys(this.bees).length;
  if (this.beesAmount)
    this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) =>
      curr.creep.memory.born < prev.creep.memory.born ? curr : prev
    ).creep.memory.born;
}

export function removeBee(this: Master<MasterParent>, bee: Bee) {
  bee.master = undefined;
  bee.memory.refMaster = "";
  bee.state = beeStates.chill;
  this.deleteBee(bee.ref);
}

export function checkBees(
  this: Master<MasterParent>,
  spawnWhenExtreme: boolean = false,
  spawnCycle: number = CREEP_LIFE_TIME - 10
): boolean {
  // failsafe for spawning bees without checking
  this.checkBeforeWish = true;
  // in case we recalc something there
  const targetBeeCount = this.targetBeeCount;
  // in 4 ifs to be able to read...
  if (
    this.waitingForBees > BEE_QUE_PER_MASTER ||
    targetBeeCount === 0 ||
    spawnCycle < 0
  )
    return false;
  if (!spawnWhenExtreme && this.hive.state !== hiveStates.economy) return false;
  if (
    (this.hive.bassboost || this.hive).cells.defense.timeToLand <
    spawnCycle / 2
  )
    return false;
  const beesAmountFuture = this.beesAmount + this.waitingForBees;
  return (
    beesAmountFuture < targetBeeCount ||
    (beesAmountFuture === targetBeeCount &&
      this.oldestSpawn + spawnCycle <= Game.time &&
      !this.waitingForBees) // no more then one bee on cycle spawn que
  );
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
