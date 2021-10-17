import { SwarmMaster } from "../_SwarmMaster";

import { prefix, beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { CIVILIAN_FLEE_DIST } from "../_Master";

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
      if (this.res && this.res !== "energy") {
        this.setup.fixed = [TOUGH, TOUGH];
        this.boosts = [{ type: "capacity", lvl: 0 }, { type: "fatigue", lvl: 0 }];
      }
    } else {
      this.setup = setups.puppet;
      this.priority = 2; // well it IS cheap -_-
    }
  }

  update() {
    super.update();

    if (!this.beesAmount && this.res && (!this.hive.cells.storage || !this.hive.cells.storage.storage.store.getUsedCapacity(this.res))) {
      this.order.delete(true);
      return;
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

    if (this.checkBees() && Game.time >= this.oldestSpawn + CREEP_LIFE_TIME - 100) {
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
      let enemy = Apiary.intel.getEnemyCreep(bee, 25);

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
          if (enemy && enemy.pos.getRangeTo(bee) < CIVILIAN_FLEE_DIST) {
            bee.flee(enemy, this.hive.cells.defense);
          }
          bee.state = beeStates.chill;
          break;
      }
    });
  }
}
