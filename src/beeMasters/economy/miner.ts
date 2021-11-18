import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";
// import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { ResourceCell } from "../../cells/base/resourceCell";
import type { Bee } from "../../bees/bee";
// import type { Boosts } from "../_Master";

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
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
    let shouldSpawn = (roomInfo.dangerlvlmax < 3 || this.cell.pos.roomName === this.hive.pos.roomName)
      && (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username);

    if (shouldSpawn)
      shouldSpawn = this.cell.operational || (this.cell.resourceType === RESOURCE_ENERGY && this.cell.pos.roomName in Game.rooms && !!this.construction);

    if (shouldSpawn && this.checkBees(this.cell.resourceType === RESOURCE_ENERGY, CREEP_LIFE_TIME - this.cell.roadTime - 10)) {
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

  get construction() {
    if (this.cell.resourceType !== RESOURCE_ENERGY)
      return undefined;

    if (this.cell.pos.roomName === this.hive.roomName) {
      let construction = this.cell.resource.pos.findInRange(FIND_CONSTRUCTION_SITES, 2).filter(c => c.structureType === STRUCTURE_LINK)[0];
      if (construction)
        return construction;
    }
    return this.cell.resource.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).filter(c => c.structureType === STRUCTURE_CONTAINER)[0];
  }

  run() {
    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, Infinity);
    let sourceOff: boolean | undefined = !this.cell.operational;
    if (this.cell.pos.roomName in Game.rooms)
      sourceOff = (sourceOff && !this.construction)
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

      let shouldTransfer = (bee.state !== beeStates.chill && bee.creep.store.getUsedCapacity(this.cell.resourceType) > 25)
        || (bee.ticksToLive < 2 && bee.creep.store.getUsedCapacity(this.cell.resourceType));

      if (lairSoonSpawn)
        shouldTransfer = true;

      if (shouldTransfer) {
        let target;
        if (this.cell.link && this.cell.link.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity(this.cell.resourceType))
          target = this.cell.container;
        if (target) {
          if (bee.pos.isNearTo(target) || bee.store.getFreeCapacity(this.cell.resourceType) === 0)
            bee.transfer(target, this.cell.resourceType);
        } else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 25) {
          let construction = this.construction;
          if (construction) {
            bee.build(construction);
            sourceOff = true;
          }
        }
      }

      switch (bee.state) {
        case beeStates.work:
          if (!bee.pos.equal(this.cell.pos)) {
            bee.goTo(this.cell.pos, this.hive.opts);
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
      if (this.checkFlee(bee)) {
        if (bee.targetPosition && bee.store.getUsedCapacity() > 0)
          bee.drop(findOptimalResource(bee.store));
      } else {
        if (lairSoonSpawn)
          if (bee.pos.getRangeTo(this.cell.lair!) < 5)
            bee.goTo(this.hive);
          else
            bee.targetPosition = undefined;
      }
    });
  }
}
