import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { Order } from "../../order";

// this will become outdated soon

@profile
export class PortalMaster extends SwarmMaster {
  maxSpawns = Infinity;
  setup = setups.puppet;
  priority: 2 | 9 = 2;

  constructor(order: Order, mode?: "boost" | "claim") {
    super(order);
    switch (mode) {
      case "boost":
        this.targetBeeCount = 3;
        this.setup = setups.bootstrap;
        this.priority = 9;
        break;
      case "claim":
        this.targetBeeCount = 1;
        this.setup = setups.claimer;
        this.priority = 9;
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
