import { Master } from "./_Master";
import { Hive } from "../Hive";
import { resourceCell } from "../cells/resourceCell"
import { Bee } from "../Bee"
import { Setups } from "../creepSetups"

export class minerMaster extends Master {
  cell: resourceCell;
  miners: Bee[] = [];
  lastSpawned: number;

  constructor(hive: Hive, resourceCell: resourceCell) {
    super(hive);
    this.cell = resourceCell;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
  }

  update() {
    // 5 for random shit
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME) {
      this.hive.wish(Setups.miner.energy);
    }
  };

  run() {
    _.forEach(this.miners, (bee) => {
      if (bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (bee.creep.pos.isNearTo(this.cell.source))
          bee.harvest(this.cell.source);
        else
          bee.goTo(this.cell.source.pos);
      }



      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 25) {
        let target: Structure | undefined;
        if (this.cell.link && this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.cell.link;
        else if (this.cell.container && this.cell.container.store.getFreeCapacity(RESOURCE_ENERGY))
          target = this.cell.container;

        if (target) {
          if (bee.creep.pos.isNearTo(target))
            bee.transfer(target, RESOURCE_ENERGY);
        }
      }
    });
  };
}
