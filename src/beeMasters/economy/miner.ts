import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { ResourceCell } from "../../cells/base/resourceCell";
import type { Boosts } from "../_Master";

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
  cooldown: number = 0;
  movePriority = <4>4;

  constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
    if (this.cell.resourceType !== RESOURCE_ENERGY) {
      this.boosts = <Boosts>[{ type: "harvest", lvl: 2 }]; //, { type: "work", lvl: 1 }, { type: "work", lvl: 0 }];
      this.hive.resTarget[BOOST_MINERAL["harvest"][2]] = LAB_BOOST_MINERAL * MAX_CREEP_SIZE;
    }
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);

    if (this.checkBees(this.cell.resourceType === RESOURCE_ENERGY) && (roomInfo.safePlace || this.cell.pos.roomName === this.hive.pos.roomName) && this.cell.operational) {
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
    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);
    let sourceOff = !this.cell.operational
      || this.cell.resource instanceof Source && this.cell.resource.energy === 0
      || this.cell.extractor && this.cell.extractor.cooldown > 0
      || (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username);

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      if (bee.state === beeStates.work && sourceOff)
        bee.state = beeStates.chill;

      this.checkFlee(bee);
      if (this.cell.lair && bee.state !== beeStates.flee && (!this.cell.lair.ticksToSpawn || this.cell.lair.ticksToSpawn <= 5)) {
        if (bee.pos.getRangeTo(this.cell.lair) < 5)
          bee.goTo(this.hive);
        bee.state = beeStates.flee;
      }

      let shouldTransfer = bee.state !== beeStates.chill && bee.creep.store.getUsedCapacity(this.cell.resourceType) > 25;
      if (bee.state === beeStates.flee)
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

      // energy from SK defenders
      if (this.cell.lair && bee.pos.isNearTo(this.cell.resource)) {
        let resource = this.cell.pos.findInRange(FIND_DROPPED_RESOURCES, 1).filter(r => r.resourceType === this.cell.resourceType)[0];
        if (resource)
          bee.pickup(resource);
      }

      switch (bee.state) {
        case beeStates.work:
          if ((bee.pos.x !== this.cell.pos.x || bee.pos.y !== this.cell.pos.y || bee.pos.roomName !== this.cell.pos.roomName) && this.cell.pos.isFree()) {
            bee.goTo(this.cell.pos);
            if (bee.pos.isNearTo(this.cell.resource))
              bee.harvest(this.cell.resource);
          } else
            bee.harvest(this.cell.resource);
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
        case beeStates.flee:
          bee.state = beeStates.work;
          break;
      }
    });
  }
}
