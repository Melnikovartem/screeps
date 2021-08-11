// amanges colony untill storage lvl
import { developmentCell } from "../../cells/developmentCell";

import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import { Bee } from "../../Bee";
import { Master } from "../_Master";

type workTypes = "upgrade" | "repair" | "build" | "refill" | "mining" | "working";

import { VISUALS_ON } from "../../settings";

let maxSize = 6;

export class bootstrapMaster extends Master {
  workers: Bee[] = [];

  cell: developmentCell;

  targetBeeCount: number = 0;
  waitingForABee: number = 0;

  // some small caching. I just couldn't resist
  stateMap: { [id: string]: { type: workTypes, target: string } } = {};
  sourceTargeting: { [id: string]: { max: number, current: number } } = {};

  constructor(developmentCell: developmentCell) {
    super(developmentCell.hive, "master_" + developmentCell.ref);

    this.cell = developmentCell;

    let workBodyParts = Math.min(maxSize, Math.floor(this.hive.room.energyCapacityAvailable / 200 / 3));
    _.forEach(this.cell.sources, (source) => {
      let walkablePositions = source.pos.getWalkablePositions().length;
      // 3000/300 /(workBodyParts * 2) / kk , where kk - how much of life will be wasted on harvesting (aka magic number)
      // how many creeps the source can support at a time: Math.min(walkablePositions, 10 / (workBodyParts * 2))
      if (source.room.name == this.hive.roomName)
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / 0.5;
      else
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / 0.666; // they need to walk more;

      this.sourceTargeting[source.id] = {
        max: walkablePositions,
        current: 0,
      };
    });
    this.targetBeeCount = Math.ceil(this.targetBeeCount);
  }

  newBee(bee: Bee): void {
    bee.reusePath = 1;
    this.workers.push(bee);
    this.stateMap[bee.ref] = {
      type: "working",
      target: "",
    };
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.workers = this.clearBees(this.workers);

    if (this.workers.length < this.targetBeeCount && !this.waitingForABee && this.hive.stage == 0) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: 1,
        priority: 5, // same as non-important army
      };

      order.setup.bodySetup.patternLimit = maxSize;

      this.waitingForABee += 1;

      if (this.workers.length < this.targetBeeCount * 0.5)
        order.priority = 2;

      this.hive.wish(order);
    }
  }

  run() {
    let count: { [id: string]: number } = {
      upgrade: 0,
      repair: 0,
      build: 0,
      refill: 0,
    };

    let sourceTargetingCurrent: { [id: string]: number } = {};

    _.forEach(this.cell.sources, (source) => {
      sourceTargetingCurrent[source.id] = 0;
    });

    _.forEach(this.workers, (bee) => {

      if (this.stateMap[bee.ref].type != "mining" && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        this.stateMap[bee.ref] = {
          type: "mining",
          target: "",
        };
        if (VISUALS_ON)
          bee.creep.say('🔄');
      }

      if (this.stateMap[bee.ref].type == "mining" && bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
        this.stateMap[bee.ref] = {
          type: "working",
          target: "",
        };
        if (VISUALS_ON)
          bee.creep.say('🛠️');
      }

      if (this.stateMap[bee.ref].type == "mining") {
        let source: Source | null;

        if (this.stateMap[bee.ref].target == "") {
          // find new source
          // next lvl caching would be to calculate all the remaining time to fill up and route to source and check on that
          // but that is too much for too little
          source = <Source>bee.creep.pos.findClosest(
            _.filter(this.cell.sources,
              (source) => this.sourceTargeting[source.id].current < this.sourceTargeting[source.id].max
                && (source.pos.getOpenPositions().length || bee.creep.pos.isNearTo(source)) && source.energy > 0));
          if (source) {
            this.sourceTargeting[source.id].current += 1;
            this.stateMap[bee.ref].target = source.id;
          }
        } else {
          source = Game.getObjectById(this.stateMap[bee.ref].target);
        }

        if (source) {
          if (source.energy == 0)
            this.stateMap[bee.ref].target = "";
          else {
            bee.harvest(source);
            sourceTargetingCurrent[source.id] += 1;
          }
        }
      } else {
        let target: Structure | ConstructionSite | null = Game.getObjectById(this.stateMap[bee.ref].target);
        let workType: workTypes = this.stateMap[bee.ref].type;

        // checking if target is valid
        if (workType == "refill") {
          workType = "working";
          if ((target instanceof StructureSpawn || target instanceof StructureExtension || target instanceof StructureTower)
            && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            workType = "refill";

          // idk why it wont let me mesh it all in 1 if i guess couse storage can have more then energy
          if ((target instanceof StructureStorage) && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            workType = "refill";

        } else if (workType == "repair") {
          if (!(target instanceof Structure) || target.hits == target.hitsMax)
            workType = "working";
        }

        if (workType == "working")
          target = null;

        if (!target && this.cell.controller.ticksToDowngrade <= 2000 && count["upgrade"] == 0) {
          target = this.cell.controller;
          workType = "upgrade";
        }

        if (!target && this.hive.cells.respawnCell) {
          let targets: (StructureSpawn | StructureExtension)[] = this.hive.cells.respawnCell.spawns;
          targets = _.filter(targets.concat(this.hive.cells.respawnCell.extensions),
            (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
          if (targets.length) {
            target = bee.creep.pos.findClosest(targets);
            workType = "refill";
          }
        }

        if (!target && this.hive.cells.defenseCell) {
          let targets: (StructureTower)[] = _.filter(this.hive.cells.defenseCell.towers,
            (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
          if (targets.length) {
            target = bee.creep.pos.findClosest(targets);
            workType = "refill";
          }
        }

        if (!target && this.hive.cells.storageCell) {
          target = this.hive.cells.storageCell.storage;
          workType = "refill";
        }

        if (!target && count["build"] + count["repair"] <= Math.ceil(this.targetBeeCount * 0.75)) {
          if (!target) {
            target = <Structure>bee.creep.pos.findClosest(this.hive.emergencyRepairs)
            workType = "repair";
          }

          if (!target) {
            target = <ConstructionSite>bee.creep.pos.findClosest(this.hive.constructionSites);
            workType = "build";
          }
        }

        if (!target) {
          target = this.cell.controller;
          workType = "upgrade";
        }

        //second check is kinda useless one, but sure
        if (workType == "build" && target instanceof ConstructionSite)
          bee.build(target);
        else if (workType == "repair" && target instanceof Structure)
          bee.repair(target);
        else if (workType == "refill" && target instanceof Structure)
          bee.transfer(target, RESOURCE_ENERGY);
        else if (workType == "upgrade" && target instanceof StructureController)
          bee.upgradeController(target);
        else
          workType = "working";

        count[workType] += 1;
        this.stateMap[bee.ref].type = workType;
        this.stateMap[bee.ref].target = target.id;
      }
    });

    _.forEach(sourceTargetingCurrent, (current, sourceId) => {
      this.sourceTargeting[<string>sourceId].current = current;
    });
  }
}