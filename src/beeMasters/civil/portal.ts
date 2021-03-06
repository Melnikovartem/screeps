import { SwarmMaster } from "../_SwarmMaster";

import { prefix, beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { FlagOrder } from "../../order";

// this will become outdated soon

@profile
export class PortalMaster extends SwarmMaster {
  maxSpawns = Infinity;
  setup = setups.puppet;
  priority: 2 | 9 = 9;
  res: ResourceConstant | undefined;
  cycle: number = CREEP_LIFE_TIME;

  constructor(order: FlagOrder) {
    super(order);
    if (this.order.ref.includes(prefix.boost)) {
      this.setup = setups.bootstrap.copy();
      this.setup.patternLimit += 4;
    } else if (this.order.ref.includes(prefix.claim)) {
      this.setup = setups.claimer;
      this.cycle = CREEP_CLAIM_LIFE_TIME;
    } else if (this.order.ref.includes(prefix.annex)) {
      this.setup = setups.claimer.copy();
      this.setup.patternLimit += 2;
    } else if (this.order.ref.includes("defense")) {
      this.setup = setups.defender.destroyer.copy();
    } else if (this.order.ref.includes("harass")) {
      this.setup = setups.knight.copy();
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.order.ref.includes("transfer")) {
      this.setup = setups.hauler.copy();
      let parsed = /transfer_(.*)/.exec(this.order.ref);
      if (parsed)
        this.res = <ResourceConstant>parsed[1];
      if (this.res && this.res.length > 1) {
        this.setup.fixed = [TOUGH];
        this.setup.moveMax = "best";
      }
    } else {
      this.setup = setups.puppet;
      this.priority = 2; // well it IS cheap -_-
    }
  }

  update() {
    super.update();

    let shouldSpawn = Game.time >= this.oldestSpawn + this.cycle - 100;
    if (!this.beesAmount && this.res) {
      if (!this.hive.cells.storage) {
        this.order.delete();
        return;
      }
      if (!this.ref.includes("keep") && !this.hive.cells.storage.getUsedCapacity(this.res)) {
        this.order.delete();
        return;
      }

      let inStore = this.hive.cells.storage.storage.store.getUsedCapacity(this.res);
      shouldSpawn = inStore > 2048;
      this.targetBeeCount = inStore > 4096 ? 2 : 1;
    }

    if (this.pos.roomName in Game.rooms) {
      let portal = this.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
      if (!portal) {
        portal = Game.rooms[this.pos.roomName].find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
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
      switch (bee.state) {
        case beeStates.boosting:
          return;
        case beeStates.chill:
          if (this.res && bee.store.getFreeCapacity(this.res) && this.hive.cells.storage && this.hive.cells.storage.storage.store.getUsedCapacity(this.res)) {
            bee.withdraw(this.hive.cells.storage.storage, this.res);
            break;
          }
          let pos = this.pos;
          if (this.pos.roomName in Game.rooms) {
            let portal = this.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
            if (portal)
              pos = portal.pos;
          }
          bee.goTo(pos);
          this.checkFlee(bee, undefined, undefined, false, 200);
          break;
      }
    });
  }
}
