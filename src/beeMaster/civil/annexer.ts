import { Setups } from "../../creepSetups";

import { Hive, spawnOrder } from "../../Hive";
import { Bee } from "../../Bee";
import { Master } from "../_Master";

export class annexMaster extends Master {
  claimers: Bee[] = [];
  lastSpawned: number;
  controller: StructureController; //controllers rly don't age...

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "master_" + "annexerRoom_" + controller.room.name);

    this.controller = controller;
    this.lastSpawned = Game.time - CREEP_CLAIM_LIFE_TIME;
  }

  newBee(bee: Bee): void {
    this.claimers.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.claimers, (bee) => {
      let ticksToLive: number = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
      if (Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive) >= this.lastSpawned)
        this.lastSpawned = Game.time - (CREEP_CLAIM_LIFE_TIME - ticksToLive);
    });
  }

  update() {
    this.claimers = this.clearBees(this.claimers);

    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_CLAIM_LIFE_TIME) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.claimer,
        amount: 1,
        priority: 2,
      };

      let controller = Game.getObjectById(this.controller.id);
      if (controller)
        this.controller = controller;

      // 4200 - funny number)) + somewhat close to theoretically optimal 5000-600
      if (this.controller && this.controller.reservation && this.controller.reservation.ticksToEnd >= 4200)
        order.setup.bodySetup.patternLimit = 1; //make smaller if not needed


      this.hive.wish(order);
      // well he placed an order now just need to catch a creep after a spawn
      this.lastSpawned = Game.time;
    }
  }

  run() {
    _.forEach(this.claimers, (bee) => {
      bee.reserveController(this.controller);
    });
  }
}
