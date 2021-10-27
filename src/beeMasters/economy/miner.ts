import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
// import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { ResourceCell } from "../../cells/base/resourceCell";
import type { Bee } from "../../bees/bee";
// import type { Boosts } from "../_Master";

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
  cooldown: number = 0;
  movePriority = <4>4;

  constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
    /* it just mines too fast for me to handle :/
    if (this.cell.resourceType !== RESOURCE_ENERGY) {
      this.boosts = <Boosts>[{ type: "harvest", lvl: 2 }]; //, { type: "work", lvl: 1 }, { type: "work", lvl: 0 }];
      this.hive.resTarget[BOOST_MINERAL["harvest"][2]] = LAB_BOOST_MINERAL * MAX_CREEP_SIZE;
    }*/
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.cell.parentCell.shouldRecalc = true;
  }

  getBeeRate() {
    let beeRates = _.map(this.bees, b => {
      let work = 0;
      _.forEach(b.body, part => {
        if (part.type === WORK) {
          let boost = part.boost && BOOSTS.work[part.boost]
          work += boost && "harvest" in boost ? boost.harvest : 1;
        }
      });
      return work * 2;
    });
    let beeRate = Math.max(0, ...beeRates);
    if (this.cell.resourceType !== RESOURCE_ENERGY)
      beeRate /= 5
    return beeRate;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);

    if (this.checkBees(this.cell.resourceType === RESOURCE_ENERGY) && (roomInfo.dangerlvlmax < 3 || this.cell.pos.roomName === this.hive.pos.roomName)
      && this.cell.operational && (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username)) {
      let order = {
        setup: setups.miner.energy,
        priority: <2 | 5 | 6>2,
      };

      if (this.cell.resourceType !== RESOURCE_ENERGY) {
        order.setup = setups.miner.minerals;
        order.priority = 6;
      } else if (this.cell.pos.roomName !== this.hive.roomName)
        order.priority = 5;

      this.wish(order);
    }
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, Infinity);
    let sourceOff = !this.cell.operational
      || (this.cell.resource instanceof Source && this.cell.resource.energy === 0)
      || (this.cell.extractor && this.cell.extractor.cooldown > 0)
      || (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username)
      || (this.cell.container && !this.cell.link && !this.cell.container.store.getFreeCapacity(this.cell.resourceType))
      || (this.cell.link && !this.cell.link.store.getFreeCapacity(this.cell.resourceType));

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK) {
          this.cell.parentCell.shouldRecalc = true;
          bee.state = beeStates.chill;
        }
    });

    let lairSoonSpawn = this.cell.lair && (!this.cell.lair.ticksToSpawn || this.cell.lair.ticksToSpawn <= 5);

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      if (bee.state === beeStates.work && sourceOff)
        bee.state = beeStates.chill;

      let shouldTransfer = bee.state !== beeStates.chill && bee.creep.store.getUsedCapacity(this.cell.resourceType) > 25;
      if (lairSoonSpawn)
        shouldTransfer = true;

      if (shouldTransfer) {
        let target;
        if (this.cell.link && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.container;
        if (target && bee.pos.isNearTo(target) || bee.store.getFreeCapacity(this.cell.resourceType) === 0)
          bee.transfer(target, this.cell.resourceType);
      }

      switch (bee.state) {
        case beeStates.work:
          if (this.cell.container && !bee.pos.equal(this.cell.container) && this.cell.container.pos.isFree()) {
            bee.goTo(this.cell.container.pos, this.hive.opts);
            if (bee.pos.isNearTo(this.cell.resource))
              bee.harvest(this.cell.resource, this.hive.opts);
          } else
            bee.harvest(this.cell.resource, this.hive.opts);
          break;
        case beeStates.chill:
          if (bee.goRest(this.cell.pos) === OK && this.cell.resourceType === RESOURCE_ENERGY) {
            let target = this.cell.container;
            if (target && target.hits < target.hitsMax) {
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
                bee.repair(target);
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) < 24 && target.store.getUsedCapacity(RESOURCE_ENERGY) >= 18)
                bee.withdraw(target, RESOURCE_ENERGY, 18);
            }
          }
          bee.state = beeStates.work;
          break;
      }
      if (!this.checkFlee(bee) && lairSoonSpawn)
        if (bee.pos.getRangeTo(this.cell.lair!) < 5)
          bee.goTo(this.hive);
        else
          bee.targetPosition = undefined;
    });
  }
}
