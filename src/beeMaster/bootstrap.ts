// amanges colony untill storage lvl
import { developmentCell } from "../cells/developmentCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class bootstrapMaster extends Master {
  workers: Bee[] = [];

  cell: developmentCell;

  targetBeeCount: number;
  waitingForABee: number = 0;

  stateMap: { [id: string]: "working" | string } = {};

  constructor(developmentCell: developmentCell) {
    super(developmentCell.hive, "master_" + developmentCell.ref);

    this.cell = developmentCell;

    this.targetBeeCount = 0;
    _.forEach(this.cell.sources, (source) => {
      this.targetBeeCount += source.pos.getOpenPositions().length * 1.5;
    });
    this.targetBeeCount = Math.ceil(this.targetBeeCount);

    // this.print(this.targetBeeCount);
    this.targetBeeCount = 3;
  }

  newBee(bee: Bee): void {
    this.workers.push(bee);
    this.stateMap[bee.ref] = "mining";
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.workers = this.clearBees(this.workers);

    if (this.workers.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: 1,
        priority: 5,
      };

      this.waitingForABee += 1;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.workers, (bee) => {

      if (this.stateMap[bee.ref] == "working" && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        this.stateMap[bee.ref] = "mining";
        bee.creep.say('🔄');
      }

      if (this.stateMap[bee.ref] != "working" && bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
        this.stateMap[bee.ref] = "working";
        bee.creep.say('🛠️');
      }

      if (this.stateMap[bee.ref] == "working") {
        let target: RoomObject | null = bee.creep.pos.findClosest(this.hive.emergencyRepairs)
        let targetType = "repair";

        if (!target) {
          target = bee.creep.pos.findClosest(this.hive.constructionSites);
          targetType = "build";
        }

        if (!target && this.hive.cells.respawnCell) {
          let targets: (StructureSpawn | StructureExtension)[] = this.hive.cells.respawnCell.spawns;
          targets = _.filter(targets.concat(this.hive.cells.respawnCell.extensions), (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
          if (targets.length) {
            target = bee.creep.pos.findClosest(targets);
            targetType = "refill";
          }
        }

        if (!target) {
          target = this.cell.controller;
          targetType = "upgrade";
        }

        //second check is kinda useless one, but sure
        if (targetType == "build" && target instanceof ConstructionSite)
          bee.build(target);
        else if (targetType == "repair" && target instanceof Structure)
          bee.repair(target);
        else if (targetType == "refill" && (target instanceof StructureSpawn || target instanceof StructureExtension))
          bee.transfer(target, RESOURCE_ENERGY);
        else if (targetType == "upgrade" && target instanceof StructureController)
          bee.upgradeController(target);
      } else {
        // some small caching. I just couldn't resist
        let source: Source | null = Game.getObjectById(this.stateMap[bee.ref]);

        // find new source if this one is clamped or not a source
        if (!source || (!source.pos.getOpenPositions().length && !bee.creep.pos.isNearTo(source)))
          source = <Source>bee.creep.pos.findClosest(
            _.filter(this.cell.sources, (source) => source.pos.getOpenPositions().length || bee.creep.pos.isNearTo(source)))

        if (source) {
          bee.harvest(source);
          this.stateMap[bee.ref] = source.id;
        }
      }
    });
  };
}
