import { SwarmMaster } from "../_SwarmMaster";

import { prefix, beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { COMPRESS_MAP } from "../../cells/stage1/factoryCell";

import { profile } from "../../profiler/decorator";
import type { Order } from "../../order";

// this will become outdated soon

@profile
export class PortalMaster extends SwarmMaster {
  maxSpawns = Infinity;
  setup = setups.puppet;
  priority: 2 | 9 = 9;
  res: ResourceConstant | undefined;

  constructor(order: Order) {
    super(order);
    if (this.order.ref.includes(prefix.boost)) {
      this.setup = setups.bootstrap.copy();
      this.setup.patternLimit += 4;
    } else if (this.order.ref.includes(prefix.claim)) {
      this.setup = setups.claimer;
    } else if (this.order.ref.includes(prefix.annex)) {
      this.setup = setups.claimer.copy();
      this.setup.patternLimit += 2;
    } else if (this.order.ref.includes("transfer")) {
      this.setup = setups.pickup.copy();
      this.setup.patternLimit = Infinity;
      let parsed = /transfer_(.*)/.exec(this.order.ref);
      if (parsed)
        this.res = <ResourceConstant>parsed[1];
      if (this.res && _.filter(COMPRESS_MAP, r => r === this.res).length) {
        this.setup.fixed = [TOUGH];
        this.boosts = [{ type: "fatigue", lvl: 0 }, { type: "capacity", lvl: 0 }];
      } else
        this.setup.patternLimit = 50 / 3;
    } else {
      this.setup = setups.puppet;
      this.priority = 2; // well it IS cheap -_-
    }
  }

  update() {
    super.update();

    let shouldSpawn = Game.time >= this.oldestSpawn + CREEP_LIFE_TIME - 100;
    if (!this.beesAmount && this.res) {
      if (!this.hive.cells.storage) {
        this.order.delete(true);
        return;
      }
      if (!this.ref.includes("keep") && !this.hive.cells.storage.getUsedCapacity(this.res)) {
        this.order.delete(true);
        return;
      }

      let inStore = this.hive.cells.storage.storage.store.getUsedCapacity(this.res);
      shouldSpawn = inStore > 2048;
      this.targetBeeCount = inStore > 20000 ? 2 : 1;
    }

    if (this.order.pos.roomName in Game.rooms) {
      let portal = this.order.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
      if (!portal) {
        portal = Game.rooms[this.order.pos.roomName].find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
        if (portal)
          this.order.flag.setPosition(portal.pos.x, portal.pos.y)
        else
          this.order.delete();
      }
    }

    if (shouldSpawn && this.checkBees()) {
      this.wish({
        setup: this.setup,
        priority: this.priority,
      });
    }
  }

  run() {
    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      let pos = this.order.pos;
      this.checkFlee(bee, this.hive);

      switch (bee.state) {
        case beeStates.chill:
          if (this.res && bee.store.getFreeCapacity(this.res) && this.hive.cells.storage && this.hive.cells.storage.storage.store.getUsedCapacity(this.res)) {
            bee.withdraw(this.hive.cells.storage.storage, this.res);
            break;
          }
          if (this.order.pos.roomName in Game.rooms) {
            let portal = this.order.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
            if (portal)
              pos = portal.pos;
          }
          bee.goTo(pos);
          break;
        case beeStates.flee:
          bee.state = beeStates.chill;
          break;
      }
    });
  }
}
