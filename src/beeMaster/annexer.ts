import { Master } from "./_Master";
import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee"
import { Setups } from "../creepSetups"

export class annexesMaster extends Master {
  claimers: Bee[] = [];
  lastSpawned: number;
  target: Room;
  controller: StructureController;

  constructor(hive: Hive, controller: StructureController) {
    super(hive);

    this.target = controller.room;
    this.controller = controller;
    this.lastSpawned = Game.time - CREEP_CLAIM_LIFE_TIME;
  }

  catchBee(bee: Bee): void {
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
        master: this,
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
      if (bee.creep.room == this.target) {
        if (bee.creep.pos.isNearTo(this.controller)) {
          bee.reserveController(this.controller);
        } else {
          bee.goTo(this.controller.pos);
        }
      } else {
        bee.goTo(this.target);
      }
    });
  };
}
