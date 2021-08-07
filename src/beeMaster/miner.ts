import { Master } from "./_Master";
import { spawnOrder } from "../Hive";
import { resourceCell } from "../cells/resourceCell";
import { Bee } from "../Bee";
import { Setups } from "../creepSetups";

export class minerMaster extends Master {
  miners: Bee[] = [];
  lastSpawned: number;

  source: Source;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;

  constructor(resourceCell: resourceCell) {
    super(resourceCell.hive);
    this.source = resourceCell.source;
    this.container = resourceCell.container;
    this.link = resourceCell.link;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    this.refreshLastSpawned();
  }

  catchBee(bee: Bee): void {
    this.miners.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.miners, (bee) => {
      if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
        this.lastSpawned = Game.time - bee.creep.ticksToLive;
    });
  }

  update() {
    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME && (this.link || this.container)
      || (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME)) {
      let order: spawnOrder = {
        master: this,
        setup: Setups.miner.energy,
        amount: 1,
      };

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.miners, (bee) => {
      if (bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (bee.creep.pos.isNearTo(this.source))
          bee.harvest(this.source);
        else
          bee.goTo(this.source.pos);
      }


      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 25) {
        let target: Structure | undefined;
        if (this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.link;
        else if (this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.container;

        if (target) {
          if (bee.creep.pos.isNearTo(target))
            bee.transfer(target, RESOURCE_ENERGY);
        }
      }
    });
  };
}
