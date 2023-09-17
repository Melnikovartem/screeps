import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { FREE_CAPACITY } from "bugSmuggling/terminalNetwork";
import type { ResourceCell } from "cells/base/resourceCell";
import { profile } from "profiler/decorator";
import { beeStates, roomStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Master } from "../_Master";

/** stop production if backlog too big  */
const STOP_MINERAL_PROD = FREE_CAPACITY.max;

@profile
export class MinerMaster extends Master<ResourceCell> {
  // #region Properties (2)

  public movePriority = 4 as const;
  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    this.parent.parentCell.shouldRecalc = true;
  };

  // #endregion Properties (2)

  // #region Public Accessors (4)

  public get beeRate() {
    const beeRates = _.map(this.activeBees, (bee) => {
      if (bee.pos.getRangeTo(this.pos) > 10) return 0;
      let work = 0;
      work += bee.workMax;
      return work;
    });
    let beeRate = Math.max(0, ...beeRates);
    if (this.resType === RESOURCE_ENERGY) beeRate *= HARVEST_POWER;
    else beeRate = (beeRate * HARVEST_MINERAL_POWER) / 6; // 1 tick harves + 5 cooldown
    return beeRate;
  }

  /** Gets contstruction site near the resource. Checks included */
  public get construction() {
    if (this.resType !== RESOURCE_ENERGY) return undefined;
    if (this.roomName !== this.hiveName && this.container) return undefined;
    if (this.roomName === this.hiveName && this.link && this.container)
      return undefined;
    if (!(this.roomName in Game.rooms) || !this.resource) return undefined;
    const res = this.resource;
    const sites = res.pos.findInRange(FIND_CONSTRUCTION_SITES, 3);

    let construction = sites.filter(
      (c) => c.structureType === STRUCTURE_ROAD
    )[0];
    if (construction) return construction;

    if (this.roomName === this.hiveName) {
      construction = sites.filter(
        (c) => c.structureType === STRUCTURE_LINK && c.pos.getRangeTo(res) <= 2
      )[0];
      if (construction) return construction;
    }
    return sites.filter(
      (c) =>
        c.structureType === STRUCTURE_CONTAINER && c.pos.getRangeTo(res) <= 1
    )[0];
  }

  public get ratePT() {
    return Math.min(this.beeRate, this.parent.ratePT);
  }

  public get targetBeeCount() {
    if (this.hive.cells.dev)
      return this.hive.cells.dev.minerBeeCount(this.parent);
    return 1;
  }

  // #endregion Public Accessors (4)

  // #region Protected Accessors (1)

  protected get shouldSpawn() {
    if (!this.hive.cells.annex.canSpawnMiners(this.roomName)) return false;
    // can mine or build smth
    return this.parent.operational || !!this.construction;
  }

  // #endregion Protected Accessors (1)

  // #region Private Accessors (5)

  private get container(): StructureContainer | undefined {
    return this.parent.container;
  }

  private get cycleOffset() {
    if (this.hive.controller.level > 2) return this.parent.roadTime + 10;
    return this.parent.roadTime * 2 + 10;
  }

  private get link(): StructureLink | undefined {
    return this.parent.link;
  }

  private get resType() {
    return this.parent.resType;
  }

  private get resource() {
    return this.parent.resource;
  }

  // #endregion Private Accessors (5)

  // #region Public Methods (2)

  public run() {
    // check if we need to run
    const lairSoonSpawn = this.parent.lairSoonSpawn;

    // this.preRunBoost();

    // check if we need to work
    let sourceOff: boolean | undefined = !this.parent.operational;

    if (this.roomName in Game.rooms) {
      const roomState = Apiary.intel.getRoomState(this.pos);
      sourceOff =
        (sourceOff && !this.construction) ||
        (this.resource instanceof Source && this.resource.energy <= 0) || // mined out :/
        (this.parent.extractor && this.parent.extractor.cooldown > 0) || // cooldown mineral
        (this.resource instanceof Mineral &&
          this.resource.mineralAmount <= 0) || // mined out :/
        (this.container &&
          !this.link &&
          !this.container.store.getFreeCapacity(this.resType)) || // no place to store resource
        (this.link && !this.link.store.getFreeCapacity(this.resType)) || // no place to store resource
        roomState === roomStates.reservedByEnemy || // cant mine
        roomState === roomStates.ownedByEnemy || // cant mine
        roomState === roomStates.reservedByInvader || // cant mine
        (this.container &&
          !this.link &&
          this.container.hits < this.container.hitsMax * 0.2 &&
          this.container.store.getUsedCapacity(RESOURCE_ENERGY) > 25 &&
          this.resType === RESOURCE_ENERGY); // fix container pls pls
    }

    _.forEach(this.activeBees, (bee) => {
      if (bee.state !== beeStates.chill) return;

      // mine, repair/chill, build/flee
      let mode: "mine" | "chill" | "busy" = sourceOff ? "chill" : "mine";

      if (lairSoonSpawn) {
        // fleeing from SK
        const diff =
          bee.pos.getRangeTo(this.parent.lair!) -
          Math.max(4, this.pos.getRangeTo(this.parent.lair!));
        if (diff <= 0) {
          bee.goTo(this.hive);
          mode = "busy";
        } else if (diff < 5) {
          bee.stop();
          mode = "busy";
        }
      }

      // transfer to link if valid
      if (
        this.link &&
        bee.store.getFreeCapacity(this.resType) < bee.workMax * 4 &&
        this.link?.store.getFreeCapacity(this.resType)
      )
        bee.transfer(this.link, this.resType);

      // for container transfer we just stand on it

      // if we don't have container to stand on we create one
      if (
        !this.container &&
        mode !== "busy" &&
        bee.store.getUsedCapacity(RESOURCE_ENERGY) >=
          Math.min(bee.workMax * 5, bee.store.getCapacity(RESOURCE_ENERGY)) &&
        bee.store.getUsedCapacity(RESOURCE_ENERGY)
      ) {
        const construction = this.construction;
        if (construction) {
          this.logBuilding(bee.build(construction), bee, construction);
          mode = "busy";
        }
      }

      if (!bee.pos.equal(this.pos) && mode !== "busy") {
        if (this.resource && bee.pos.isNearTo(this.resource) && mode === "mine")
          bee.harvest(this.resource, this.hive.opt);
        bee.goTo(this.pos, this.hive.opt);
      } else if (mode === "mine" && this.resource) {
        bee.harvest(this.resource, this.hive.opt);
      } else if (
        mode === "chill" &&
        bee.goTo(this.pos, this.hive.opt) === OK &&
        this.resType === RESOURCE_ENERGY
      ) {
        // repair container if nothing to do
        const target = this.container;
        if (target && target.hits < target.hitsMax) {
          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            this.logBuilding(bee.repair(target), bee, target);
          if (
            bee.store.getUsedCapacity(RESOURCE_ENERGY) < bee.workMax * 2 &&
            target.store.getUsedCapacity(RESOURCE_ENERGY) >= bee.workMax
          )
            bee.withdraw(target, RESOURCE_ENERGY, 25);
        }
      }

      // RUN as we need
      if (this.checkFlee(bee, this.hive) || lairSoonSpawn) {
        if (bee.targetPosition && bee.store.getUsedCapacity() > 0)
          bee.drop(findOptimalResource(bee.store));
      }
    });
  }

  public override update() {
    super.update();

    if (
      this.shouldSpawn &&
      this.checkBees(
        this.resType === RESOURCE_ENERGY,
        CREEP_LIFE_TIME - this.cycleOffset
      )
    ) {
      const order = {
        setup: setups.miner.minerals,
        priority: 2 as 2 | 5 | 6,
      };

      if (this.resType === RESOURCE_ENERGY) {
        if (this.roomName !== this.hiveName) order.priority = 5;
        order.setup = setups.miner.energy.copy();
        order.setup.patternLimit = Math.round(this.parent.ratePT / 2) + 1;
        if (this.link) order.setup.fixed = [CARRY, CARRY, CARRY, CARRY];
        else if (this.hive.controller.level <= 2) order.setup.fixed = [];
        if (this.hive.phase === 2 && this.hive.mode.saveCpu)
          order.setup.patternLimit *= 2; // save some cpu on mining
      } else {
        // stop producting minerals
        if (this.hive.getResState(RESOURCE_ENERGY) < 0) return;
        order.priority = 6;
      }

      this.wish(order);
    }
  }

  // #endregion Public Methods (2)

  // #region Private Methods (1)

  private logBuilding(
    ans: ScreepsReturnCode,
    bee: Bee,
    target: ConstructionSite<BuildableStructureConstant> | StructureContainer
  ) {
    if (ans !== OK) return;
    let spend;
    if (target instanceof StructureContainer) {
      spend = Math.min(
        bee.workMax,
        Math.floor((target.hitsMax - target.hits) / 100)
      );
    } else
      spend = Math.min(bee.workMax * 5, target.progressTotal - target.progress);
    spend = Math.min(bee.store.getUsedCapacity(RESOURCE_ENERGY));
    Apiary.logger.addResourceStat(
      this.hiveName,
      this.parent.loggerRef,
      spend,
      RESOURCE_ENERGY
    );
    Apiary.logger.addResourceStat(
      this.hiveName,
      this.parent.loggerUpkeepRef,
      -spend,
      RESOURCE_ENERGY
    );
  }

  // #endregion Private Methods (1)
}
