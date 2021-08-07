import { Setups } from "../creepSetups"

import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee"
import { Master } from "./_Master";

export class annexesMaster extends Master {
  claimers: Bee[] = [];
  lastSpawned: number;
  target: Room;
  controller: StructureController;

  constructor(hive: Hive, controller: StructureController) {
    super(hive, "");

    this.target = controller.room;
    this.controller = controller;
    this.lastSpawned = Game.time - CREEP_CLAIM_LIFE_TIME;

    this.updateCash(['controller']);
  }

  newBee(bee: Bee): void {
    this.claimers.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.claimers, (bee) => {
      if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
        this.lastSpawned = Game.time - bee.creep.ticksToLive;
    });
  }

  update() {
    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_CLAIM_LIFE_TIME) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.claimer,
        amount: 1,
      };

      this.hive.wish(order);
      // well he placed an order now just need to catch a creep after a spawn
      this.lastSpawned = Game.time;
    }
  };

  run() {
    _.forEach(this.claimers, (bee) => {
      bee.reserveController(this.controller);
    });
  };
}
