import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { ResourceCell } from "../../cells/base/resourceCell";

const ENEMY_DIST = 4;

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
  cooldown: number = 0;
  movePriority = <3>3;

  constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
  }

  update() {
    super.update();

    let roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 10);

    if (this.checkBees(hiveStates.battle !== this.hive.state) && roomInfo.safePlace && this.cell.operational) {
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

    let enemy = Apiary.intel.getEnemy(this.cell, 10);

    if (enemy && !(enemy instanceof Creep))
      enemy = undefined;

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.work && sourceOff)
        bee.state = beeStates.chill;

      let shouldTransfer = bee.state !== beeStates.chill && bee.creep.store.getUsedCapacity(this.cell.resourceType) > 25;
      if (enemy && enemy.pos.getRangeTo(bee) < ENEMY_DIST + 1) {
        bee.state = beeStates.flee;
        shouldTransfer = true;
      }

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
      if (this.cell.lair && bee.state !== beeStates.flee) {
        let resource = this.cell.pos.findInRange(FIND_DROPPED_RESOURCES, 1, { filter: { type: this.cell.resourceType } })[0];
        if (resource)
          bee.pickup(resource);
      }

      switch (bee.state) {
        case beeStates.work:
          if (this.cell.pos.isFree() && bee.pos.isNearTo(this.cell.pos))
            bee.goTo(this.cell.pos);
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
          if (enemy && enemy.pos.getRangeTo(bee) < ENEMY_DIST) {
            bee.flee(enemy, this.hive.getPos("center"));
          } else {
            if (this.cell.lair && this.cell.lair.pos.getRangeTo(bee) < ENEMY_DIST)
              bee.flee(this.cell.lair, this.hive.pos);
          }
          bee.state = beeStates.work;
          break;
      }
    });
  }
}
