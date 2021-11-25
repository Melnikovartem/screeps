import { Master } from "../_Master";

import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { ResourceCell } from "../../cells/base/resourceCell";
import type { Bee } from "../../bees/bee";

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
  movePriority = <4>4;

  sourceOff: boolean | undefined;

  constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.cell.parentCell.shouldRecalc = true;
  }

  get beeRate() {
    let beeRates = _.map(this.bees, b => {
      let work = 0;
      _.forEach(b.body, part => {
        if (part.type === WORK) {
          let boost = part.boost && BOOSTS.work[part.boost]
          work += boost && "harvest" in boost ? boost.harvest : 1;
        }
      });
      return work;
    });
    let beeRate = Math.max(0, ...beeRates);
    if (this.cell.resourceType === RESOURCE_ENERGY)
      beeRate *= 2;
    else
      beeRate /= 5;
    return beeRate;
  }

  get ratePT() {
    return Math.min(this.beeRate, this.cell.ratePT);
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 20);
    let shouldSpawn = (roomInfo.dangerlvlmax < 4 || this.cell.pos.roomName === this.hive.pos.roomName)
      && (roomInfo.currentOwner === Apiary.username || !roomInfo.currentOwner);

    if (shouldSpawn)
      shouldSpawn = this.cell.operational || (this.cell.resourceType === RESOURCE_ENERGY && this.cell.pos.roomName in Game.rooms && !!this.construction);

    if (shouldSpawn && this.checkBees(this.cell.resourceType === RESOURCE_ENERGY, CREEP_LIFE_TIME - this.cell.roadTime - 10)) {
      let order = {
        setup: setups.miner.minerals,
        priority: <2 | 5 | 6>2,
      };

      if (this.cell.resourceType === RESOURCE_ENERGY) {
        if (this.cell.pos.roomName !== this.hive.roomName)
          order.priority = 5;
        order.setup = setups.miner.energy.copy();
        order.setup.patternLimit = Math.round(this.cell.ratePT / 2) + 1;
      } else
        order.priority = 6;

      this.wish(order);
    }
  }

  get construction() {
    if (this.cell.resourceType !== RESOURCE_ENERGY)
      return undefined;
    if (this.cell.container && (this.cell.pos.roomName !== this.hive.roomName || this.cell.link))
      return undefined;

    let construction = this.cell.resource.pos.findInRange(FIND_CONSTRUCTION_SITES, 3).filter(c => c.structureType === STRUCTURE_ROAD)[0];
    if (construction)
      return construction;

    if (this.cell.pos.roomName === this.hive.roomName) {
      construction = this.cell.resource.pos.findInRange(FIND_CONSTRUCTION_SITES, 2).filter(c => c.structureType === STRUCTURE_LINK)[0];
      if (construction)
        return construction;
    }
    return this.cell.resource.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).filter(c => c.structureType === STRUCTURE_CONTAINER)[0];
  }

  checkSource() {
    if (Game.time % 10 !== 0)
      return;
    this.sourceOff = !this.cell.operational;
    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, Infinity);
    if (this.cell.pos.roomName in Game.rooms)
      this.sourceOff = (this.sourceOff && !this.construction)
        || (this.cell.resource instanceof Source && this.cell.resource.energy === 0)
        || (this.cell.extractor && this.cell.extractor.cooldown > 0)
        || (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username)
        || (this.cell.container && !this.cell.link && !this.cell.container.store.getFreeCapacity(this.cell.resourceType))
        || (this.cell.container && !this.cell.link && this.cell.container.hits < this.cell.container.hitsMax * 0.2
          && this.cell.container.store.getUsedCapacity(RESOURCE_ENERGY) > 25 && this.cell.resourceType === RESOURCE_ENERGY)
        || (this.cell.link && !this.cell.link.store.getFreeCapacity(this.cell.resourceType))
  }

  run() {
    let lairSoonSpawn = this.cell.lair && (!this.cell.lair.ticksToSpawn
      || this.cell.lair.ticksToSpawn <= (this.cell.fleeLairTime || 5) * (this.cell.resourceType === RESOURCE_ENERGY ? 1 : 2));

    this.checkSource();
    let mode: 0 | 1 | 2 = this.sourceOff ? 1 : 0; // mine, repair/chill, build/flee

    _.forEach(this.activeBees, bee => {
      if (lairSoonSpawn) {
        let diff = bee.pos.getRangeTo(this.cell.lair!) - Math.max(4, this.cell.pos.getRangeTo(this.cell.lair!));
        if (diff <= 0)
          bee.goTo(this.hive);
        else if (diff < 5)
          bee.targetPosition = undefined;
        mode = 2;
      } else if (this.cell.link) {
        if (bee.creep.store.getUsedCapacity(this.cell.resourceType) >= 24 && this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY))
          bee.transfer(this.cell.link, this.cell.resourceType);
      } else if (!this.cell.container && bee.store.getUsedCapacity(RESOURCE_ENERGY) >= 24) {
        let construction = this.construction;
        if (construction) {
          if (bee.build(construction) === OK && Apiary.logger) {
            let spend = Math.min(bee.getBodyParts(WORK) * 5, bee.store.getUsedCapacity(RESOURCE_ENERGY), construction.progressTotal - construction.progress);
            Apiary.logger.addResourceStat(this.hive.roomName, this.cell.loggerRef, spend);
            Apiary.logger.addResourceStat(this.hive.roomName, this.cell.loggerUpkeepRef, -spend);
          }
        }
        mode = 2;
      }

      if (!lairSoonSpawn)
        if (!mode) {
          if (bee.pos.equal(this.cell.pos))
            bee.harvest(this.cell.resource, this.hive.opt);
          else {
            bee.goTo(this.cell.pos, this.hive.opt);
            if (bee.pos.isNearTo(this.cell.resource))
              bee.harvest(this.cell.resource, this.hive.opt);
          }
        } else if (mode === 1) {
          if (bee.goRest(this.cell.pos) === OK && this.cell.resourceType === RESOURCE_ENERGY) {
            let target = this.cell.container;
            if (target && target.hits < target.hitsMax) {
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (bee.repair(target) === OK && Apiary.logger) {
                  let spend = Math.min(bee.getBodyParts(WORK), bee.store.getUsedCapacity(RESOURCE_ENERGY), Math.floor((target.hitsMax - target.hits) / 100));
                  Apiary.logger.addResourceStat(this.hive.roomName, this.cell.loggerRef, spend);
                  Apiary.logger.addResourceStat(this.hive.roomName, this.cell.loggerUpkeepRef, -spend);
                }
              }
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) < 25 && target.store.getUsedCapacity(RESOURCE_ENERGY) >= 25)
                bee.withdraw(target, RESOURCE_ENERGY, 25);
            }
          }
        }

      if (this.checkFlee(bee) || lairSoonSpawn) {
        if (bee.targetPosition && bee.store.getUsedCapacity() > 0)
          bee.drop(findOptimalResource(bee.store));
      }
    });
  }
}
