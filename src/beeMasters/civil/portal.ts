import { SwarmMaster } from "../_SwarmMaster";

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
    switch (this.order.ref.slice(0, 5)) {
      case "boost":
        this.targetBeeCount = 3;
        this.setup = setups.bootstrap;
        break;
      case "claim":
        this.targetBeeCount = 1;
        this.setup = setups.claimer;
        break;
      case "destr":
        this.targetBeeCount = 1;
        this.setup = setups.destroyer;
        break;
      default:
        this.targetBeeCount = 1;
        this.setup = setups.puppet;
        this.priority = 2; // well it IS cheap -_-
        break;
    }
  }

  update() {
    super.update();

    if (this.order.pos.roomName in Game.rooms) {
      let portal = this.order.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_PORTAL)[0]
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
        amount: 1,
        priority: this.priority,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => bee.goTo(this.order.pos, { preferHighway: true }));
  }
}
