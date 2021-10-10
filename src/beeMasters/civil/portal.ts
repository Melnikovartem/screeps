import { SwarmMaster } from "../_SwarmMaster";

import { prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { Order } from "../../order";

// this will become outdated soon

@profile
export class PortalMaster extends SwarmMaster {
  maxSpawns = Infinity;
  setup = setups.puppet;
  priority: 2 | 9 = 9;

  constructor(order: Order) {
    super(order);
    if (this.order.ref.includes(prefix.boost)) {
      this.setup = setups.bootstrap.copy();
      this.setup.patternLimit += 2;
    } else if (this.order.ref.includes(prefix.claim)) {
      this.setup = setups.claimer;
    } else if (this.order.ref.includes(prefix.annex)) {
      this.setup = setups.claimer.copy();
      this.setup.patternLimit = 3;
    } else {
      this.setup = setups.puppet;
      this.priority = 2; // well it IS cheap -_-
    }
  }

  update() {
    super.update();

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
    _.forEach(this.activeBees, bee => {
      let pos = this.order.pos;
      if (this.order.pos.roomName in Game.rooms) {
        let portal = this.order.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_PORTAL)[0];
        if (portal)
          pos = portal.pos;
      }
      bee.goTo(pos);
    });
  }
}
