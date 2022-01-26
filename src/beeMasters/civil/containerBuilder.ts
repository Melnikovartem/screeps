import { SwarmMaster } from "../_SwarmMaster";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class ContainerBuilderMaster extends SwarmMaster {

  targetBeeCount = 2;
  maxSpawns = 2;

  update() {
    super.update();
    if (this.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER).length) {
      this.order.delete();
      return;
    }
    if (this.checkBees() && Apiary.intel.getInfo(this.pos.roomName).safePlace && this.hive.cells.storage) {
      let setup = setups.builder.copy();
      setup.pattern = [WORK, CARRY, CARRY];
      setup.moveMax = 50 / 3;
      this.wish({
        setup: setup,
        priority: 5,
      });
    }
  }

  run() {
    let target = Game.rooms[this.pos.roomName] && this.pos.lookFor(LOOK_CONSTRUCTION_SITES).filter(c => c.structureType === STRUCTURE_CONTAINER).pop() || { pos: this.pos };
    if (!target)
      this.pos.createConstructionSite(STRUCTURE_CONTAINER);
    let sCell = this.hive.cells.storage!;
    if (!sCell)
      return;
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.chill:
          bee.state = beeStates.refill;
        case beeStates.refill:
          let otherRes = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(RESOURCE_ENERGY);
          if (otherRes) {
            let res = <ResourceConstant | undefined>Object.keys(bee.store).filter(r => r !== RESOURCE_ENERGY)[0];
            if (res && bee.transfer(sCell.storage, res) === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "pickup", bee.store, sCell.storage.store, res, 1);
          }
          if (bee.withdraw(sCell.storage, RESOURCE_ENERGY, undefined) === OK && !otherRes) {
            bee.state = beeStates.work;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", sCell.storage.store, bee.store);
            bee.goTo(target.pos);
            break;
          }
          let resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
          if (resource)
            bee.pickup(resource);
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          } else {
            if (target instanceof ConstructionSite)
              bee.build(target);
            let resource;
            if (bee.pos.getRangeTo(target) <= 3) {
              resource = bee.pos.findClosest(target.pos.findInRange(FIND_DROPPED_RESOURCES, 3));
            } else
              resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
            if (resource)
              bee.pickup(resource);
          }
          break;
      }
      if (this.checkFlee(bee, this.hive))
        return;
    });
  }
}
