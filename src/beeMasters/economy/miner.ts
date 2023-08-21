import { FREE_CAPACITY } from "../../abstract/terminalNetwork";
import { findOptimalResource } from "../../abstract/utils";
import type { Bee } from "../../bees/bee";
import { setups } from "../../bees/creepSetups";
import type { ResourceCell } from "../../cells/base/resourceCell";
import { beeStates } from "../../enums";
import { profile } from "../../profiler/decorator";
import { Master } from "../_Master";

@profile
export class MinerMaster extends Master {
  cell: ResourceCell;
  movePriority = 4 as const;

  constructor(resourceCell: ResourceCell) {
    super(resourceCell.hive, resourceCell.ref);
    this.cell = resourceCell;
    if (
      this.cell.pos.roomName === this.hive.roomName &&
      this.cell.resourceType === RESOURCE_ENERGY
    )
      this.boosts = [{ type: "harvest", lvl: 0 }];
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.cell.parentCell.shouldRecalc = true;
  }

  public get beeRate() {
    const beeRates = _.map(this.activeBees, (bee) => {
      if (bee.pos.getRangeTo(this.cell.pos) > 10) return 0;
      let work = 0;
      work += bee.workMax * (bee.boosted ? BOOSTS.work.UO.harvest : 1);
      return work;
    });
    let beeRate = Math.max(0, ...beeRates);
    if (this.cell.resourceType === RESOURCE_ENERGY) beeRate *= 2;
    else beeRate /= 5;
    return beeRate;
  }

  get ratePT() {
    return Math.min(this.beeRate, this.cell.ratePT);
  }

  update() {
    super.update();

    const roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, Infinity);
    let shouldSpawn =
      !this.hive.annexInDanger.includes(this.cell.pos.roomName) &&
      (roomInfo.currentOwner === Apiary.username || !roomInfo.currentOwner);

    if (shouldSpawn)
      shouldSpawn =
        this.cell.operational ||
        (this.cell.resourceType === RESOURCE_ENERGY &&
          this.cell.pos.roomName in Game.rooms &&
          !!this.construction);

    if (
      shouldSpawn &&
      this.checkBees(
        this.cell.resourceType === RESOURCE_ENERGY,
        CREEP_LIFE_TIME - this.cell.roadTime - 10
      )
    ) {
      const order = {
        setup: setups.miner.minerals,
        priority: 2 as 2 | 5 | 6,
      };

      if (this.cell.resourceType === RESOURCE_ENERGY) {
        if (this.cell.pos.roomName !== this.hive.roomName) order.priority = 5;
        order.setup = setups.miner.energy.copy();
        order.setup.patternLimit = Math.round(this.cell.ratePT / 2) + 1;
        if (this.cell.link)
          // && this.hive.cells.storage && this.hive.cells.storage.getUsedCapacity(RESOURCE_UTRIUM_OXIDE) >= LAB_BOOST_MINERAL * order.setup.patternLimit
          order.setup.fixed = [CARRY, CARRY, CARRY, CARRY];
      } else {
        if (
          !this.hive.cells.storage ||
          this.hive.cells.storage.storage.store.getFreeCapacity() <=
            FREE_CAPACITY * 0.25
        )
          return;
        if (this.hive.resState[RESOURCE_ENERGY] < 0) return;
        order.priority = 6;
      }

      this.wish(order);
    }
  }

  get construction() {
    if (this.cell.resourceType !== RESOURCE_ENERGY) return undefined;
    if (
      this.cell.container &&
      (this.cell.pos.roomName !== this.hive.roomName || this.cell.link)
    )
      return undefined;

    let construction = this.cell.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 3)
      .filter((c) => c.structureType === STRUCTURE_ROAD)[0];
    if (construction) return construction;

    if (this.cell.pos.roomName === this.hive.roomName) {
      construction = this.cell.resource.pos
        .findInRange(FIND_CONSTRUCTION_SITES, 2)
        .filter((c) => c.structureType === STRUCTURE_LINK)[0];
      if (construction) return construction;
    }
    return this.cell.resource.pos
      .findInRange(FIND_CONSTRUCTION_SITES, 1)
      .filter((c) => c.structureType === STRUCTURE_CONTAINER)[0];
  }

  run() {
    const lairSoonSpawn =
      this.cell.lair &&
      (!this.cell.lair.ticksToSpawn ||
        this.cell.lair.ticksToSpawn <=
          (this.cell.fleeLairTime || 5) *
            (this.cell.resourceType === RESOURCE_ENERGY ? 1 : 2));

    let sourceOff: boolean | undefined = !this.cell.operational;
    if (this.cell.pos.roomName in Game.rooms) {
      const roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, Infinity);
      sourceOff =
        (sourceOff && !this.construction) ||
        (this.cell.resource instanceof Source &&
          this.cell.resource.energy === 0) ||
        (this.cell.extractor && this.cell.extractor.cooldown > 0) ||
        (this.cell.container &&
          !this.cell.link &&
          !this.cell.container.store.getFreeCapacity(this.cell.resourceType)) ||
        (this.cell.link &&
          !this.cell.link.store.getFreeCapacity(this.cell.resourceType)) ||
        (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username) ||
        (this.cell.container &&
          !this.cell.link &&
          this.cell.container.hits < this.cell.container.hitsMax * 0.2 &&
          this.cell.container.store.getUsedCapacity(RESOURCE_ENERGY) > 25 &&
          this.cell.resourceType === RESOURCE_ENERGY);
    }
    let mode: 0 | 1 | 2 = sourceOff ? 1 : 0; // mine, repair/chill, build/flee

    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting)
        if (
          !this.hive.shouldDo("saveCpu") ||
          !this.hive.cells.lab ||
          this.hive.cells.lab.askForBoost(bee) === OK
        )
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;
      const old = bee.boosted && bee.ticksToLive < this.cell.roadTime + 20;
      const lab =
        old &&
        this.hive.cells.lab &&
        this.hive.cells.lab.getUnboostLab(bee.ticksToLive);
      if (lab) {
        bee.goTo(lab.pos, { range: 1 });
        mode = 2;
        if (bee.store.getUsedCapacity()) {
          const res = findOptimalResource(bee.store);
          if (
            this.cell.link &&
            this.cell.link.pos.isNearTo(bee) &&
            this.cell.link.store.getFreeCapacity(res)
          )
            bee.transfer(this.cell.link, res);
          else if (
            this.cell.container &&
            this.cell.container.pos.isNearTo(bee) &&
            this.cell.container.store.getFreeCapacity(res)
          )
            bee.transfer(this.cell.container, res);
          else bee.drop(res);
        }
      } else if (lairSoonSpawn) {
        const diff =
          bee.pos.getRangeTo(this.cell.lair!) -
          Math.max(4, this.cell.pos.getRangeTo(this.cell.lair!));
        if (diff <= 0) bee.goTo(this.hive);
        else if (diff < 5) bee.stop();
        mode = 2;
      } else if (this.cell.link) {
        if (
          bee.store.getFreeCapacity(this.cell.resourceType) <
            bee.workMax * (bee.boosted ? BOOSTS.work.UO.harvest : 1) * 2 * 2 &&
          this.cell.link.store.getFreeCapacity(RESOURCE_ENERGY)
        )
          bee.transfer(this.cell.link, this.cell.resourceType);
      } else if (
        !this.cell.container &&
        bee.store.getUsedCapacity(RESOURCE_ENERGY) >=
          Math.min(bee.workMax * 5, bee.store.getCapacity(RESOURCE_ENERGY))
      ) {
        const construction = this.construction;
        mode = 2;
        if (construction) {
          if (bee.build(construction) === OK && Apiary.logger) {
            const spend = Math.min(
              bee.workMax * 5,
              bee.store.getUsedCapacity(RESOURCE_ENERGY),
              construction.progressTotal - construction.progress
            );
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              this.cell.loggerRef,
              spend,
              RESOURCE_ENERGY
            );
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              this.cell.loggerUpkeepRef,
              -spend,
              RESOURCE_ENERGY
            );
          }
        } else if (this.cell.lair) mode = 0;
      }

      if (!lairSoonSpawn)
        if (!mode) {
          if (bee.pos.equal(this.cell.pos))
            bee.harvest(this.cell.resource, this.hive.opt);
          else {
            bee.goTo(this.cell.pos, this.hive.opt);
            if (bee.pos.isNearTo(this.cell.resource))
              bee.harvest(this.cell.resource, this.hive.opt);
          }
        } else if (mode === 1) {
          if (
            bee.goTo(this.cell.pos) === OK &&
            this.cell.resourceType === RESOURCE_ENERGY
          ) {
            const target = this.cell.container;
            if (target && target.hits < target.hitsMax) {
              if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (bee.repair(target) === OK && Apiary.logger) {
                  const spend = Math.min(
                    bee.workMax,
                    bee.store.getUsedCapacity(RESOURCE_ENERGY),
                    Math.floor((target.hitsMax - target.hits) / 100)
                  );
                  Apiary.logger.addResourceStat(
                    this.hive.roomName,
                    this.cell.loggerRef,
                    spend,
                    RESOURCE_ENERGY
                  );
                  Apiary.logger.addResourceStat(
                    this.hive.roomName,
                    this.cell.loggerUpkeepRef,
                    -spend,
                    RESOURCE_ENERGY
                  );
                }
              }
              if (
                bee.store.getUsedCapacity(RESOURCE_ENERGY) < bee.workMax * 2 &&
                target.store.getUsedCapacity(RESOURCE_ENERGY) >= bee.workMax
              )
                bee.withdraw(target, RESOURCE_ENERGY, 25);
            }
          }
        }

      if (this.checkFlee(bee, this.hive) || lairSoonSpawn) {
        if (bee.targetPosition && bee.store.getUsedCapacity() > 0)
          bee.drop(findOptimalResource(bee.store));
      }
    });
  }
}
