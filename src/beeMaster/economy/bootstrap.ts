// amanges colony untill storage lvl
import { developmentCell } from "../../cells/stage0/developmentCell";

import { Bee } from "../../Bee";
import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

type workTypes = "upgrade" | "repair" | "build" | "refill" | "mining" | "working";

import { VISUALS_ON } from "../../settings";

@profile
export class bootstrapMaster extends Master {
  cell: developmentCell;

  // some small caching. I just couldn't resist
  stateMap: { [id: string]: { type: workTypes, target: string } } = {};
  sourceTargeting: { [id: string]: { max: number, current: number } } = {};

  constructor(developmentCell: developmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
    this.recalculateTargetBee();
  }

  recalculateTargetBee() {
    this.targetBeeCount = 0;
    let workBodyParts = Math.floor(this.hive.room.energyCapacityAvailable / 200);
    if (this.hive.bassboost)
      workBodyParts = Math.floor(this.hive.bassboost.room.energyCapacityAvailable / 200)
    if (Setups.bootstrap.bodySetup.patternLimit)
      workBodyParts = Math.min(Setups.bootstrap.bodySetup.patternLimit, workBodyParts);

    // theoretically i should count road from minerals to controller, but this is good enough
    let magicNumber = [0.5, 0.666];
    if (workBodyParts > 3)
      magicNumber = [0.35, 0.45]; // more upgrading less mining
    _.forEach(this.cell.sources, (source) => {
      let walkablePositions = source.pos.getOpenPositions(true).length;
      // 3000/300 /(workBodyParts * 2) / kk , where kk - how much of life will be wasted on harvesting (aka magic number)
      // how many creeps the source can support at a time: Math.min(walkablePositions, 10 / (workBodyParts * 2))
      if (source.room.name == this.hive.roomName)
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / magicNumber[0];
      else
        this.targetBeeCount += Math.min(walkablePositions, 10 / (workBodyParts * 2)) / magicNumber[1]; // they need to walk more;

      if (!this.sourceTargeting[source.id])
        this.sourceTargeting[source.id] = {
          max: walkablePositions,
          current: 0,
        };
    });
    this.targetBeeCount = Math.ceil(this.targetBeeCount);
  }

  newBee(bee: Bee): void {
    super.newBee(bee);
    bee.reusePath = 1;
    this.stateMap[bee.ref] = {
      type: "working",
      target: "",
    };
  }

  update() {
    super.update();

    if (Game.time % 100 == 97)
      this.recalculateTargetBee(); // just to check if expansions are done

    if (this.checkBees() && this.hive.stage == 0) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.bootstrap,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 9,
      };

      if (this.beesAmount < this.targetBeeCount * 0.5) {
        order.priority = 2;
        order.amount = Math.ceil(this.targetBeeCount / 2 - this.beesAmount);
      }

      this.wish(order);
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

    _.forEach(this.bees, (bee) => {

      if (this.stateMap[bee.ref].type != "mining" && bee.creep.store[RESOURCE_ENERGY] == 0) {
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
          source = <Source>bee.pos.findClosest(
            _.filter(this.cell.sources,
              (source) => this.sourceTargeting[source.id].current < this.sourceTargeting[source.id].max
                && (source.pos.getOpenPositions().length || bee.pos.isNearTo(source)) && source.energy > 0));
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
        } else
          bee.goRest(this.hive.pos);
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

        if (!target) {
          let targets: (StructureSpawn | StructureExtension)[] = this.hive.cells.spawn.spawns;
          targets = _.filter(targets.concat(this.hive.cells.spawn.extensions),
            (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
          if (targets.length) {
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }
        }

        if (!target) {
          let targets: (StructureTower)[] = _.filter(this.hive.cells.defense.towers,
            (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
          if (targets.length) {
            target = bee.pos.findClosest(targets);
            workType = "refill";
          }
        }

        if (!target && this.hive.room.storage) {
          // if build the storage, but it is not yet recreated into stage 1 hive
          target = this.hive.room.storage;
          workType = "refill";
        }

        if (!target && count["build"] + count["repair"] <= Math.ceil(this.targetBeeCount * 0.75)) {
          if (!target) {
            target = <Structure>bee.pos.findClosest(this.hive.emergencyRepairs)
            workType = "repair";
          }

          if (!target) {
            target = <ConstructionSite>bee.pos.findClosest(this.hive.constructionSites);
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
