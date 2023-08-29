import { setups } from "bees/creepSetups";
import { COMMODITIES_TO_SELL } from "cells/stage1/factoryCell";
import type { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

// this will become outdated soon

const HAUL_PER_TRIP = 1_000;

@profile
export class PortalMaster extends SwarmMaster {
  public setup = setups.puppet;
  public priority: 2 | 9 = 9;
  public res: ResourceConstant | undefined;
  public cycle: number = CREEP_LIFE_TIME;
  private commodities = false;

  public constructor(order: FlagOrder) {
    super(order);
    this.maxSpawns = Infinity;
    if (this.order.ref.includes(prefix.boost)) {
      this.setup = setups.bootstrap.copy();
      this.setup.patternLimit += 4;
    } else if (this.order.ref.includes(prefix.claim)) {
      this.setup = setups.claimer;
      this.cycle = CREEP_CLAIM_LIFE_TIME;
    } else if (this.order.ref.includes(prefix.annex)) {
      this.setup = setups.claimer.copy();
      this.setup.patternLimit += 2;
    } else if (this.order.ref.includes("defense")) {
      this.setup = setups.defender.destroyer.copy();
    } else if (this.order.ref.includes("harass")) {
      this.setup = setups.knight.copy();
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.order.ref.includes("transfer")) {
      this.setup = setups.hauler.copy();
      const parsed = /transfer_(.*)/.exec(this.order.ref);
      if (parsed) this.res = parsed[1] as ResourceConstant;
      this.commodities = COMMODITIES_TO_SELL.includes(
        this.res as DepositConstant
      );
      if (this.res && this.commodities) {
        this.setup.fixed = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH];
        this.setup.moveMax = "best";
        /* this.boosts = [
          { type: "damage", lvl: 2 },
          { type: "heal", lvl: 2 },
        ]; */
        if (this.hive.resTarget[this.res] === undefined)
          this.hive.resTarget[this.res] = 0;
        this.hive.resTarget[this.res] += HAUL_PER_TRIP;
      } else this.setup.fixed = [TOUGH];
    } else {
      this.setup = setups.puppet;
      this.priority = 2; // well it IS cheap -_-
    }
  }

  public update() {
    super.update();

    let shouldSpawn = Game.time >= this.oldestSpawn + this.cycle - 100;
    if (!this.beesAmount && this.res) {
      if (!this.hive.cells.storage) {
        this.order.delete();
        return;
      }
      if (
        this.ref.includes("nokeep") &&
        !this.hive.cells.storage.getUsedCapacity(this.res)
      ) {
        this.order.delete();
        return;
      }

      const inStore = this.hive.cells.storage.storage.store.getUsedCapacity(
        this.res
      );
      shouldSpawn = inStore >= HAUL_PER_TRIP;
      this.targetBeeCount = inStore >= HAUL_PER_TRIP * 3 ? 2 : 1;
    }

    if (this.pos.roomName in Game.rooms) {
      let portal = this.pos
        .findInRange(FIND_STRUCTURES, 1)
        .filter((s) => s.structureType === STRUCTURE_PORTAL)[0];
      if (!portal) {
        portal = Game.rooms[this.pos.roomName]
          .find(FIND_STRUCTURES)
          .filter((s) => s.structureType === STRUCTURE_PORTAL)[0];
        if (portal) this.order.flag.setPosition(portal.pos.x, portal.pos.y);
        else this.order.delete();
      }
    }

    if (shouldSpawn && this.checkBees()) {
      if (this.res) {
        // check exit if cargo
        if (!Apiary.intel.getInfo(this.pos.roomName).safePlace) return;
      }

      this.wish({
        setup: this.setup,
        priority: this.priority,
      });
    }
  }

  public run() {
    this.preRunBoost();
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.chill) {
        if (
          this.res &&
          bee.store.getFreeCapacity(this.res) &&
          this.hive.cells.storage &&
          this.hive.cells.storage.storage.store.getUsedCapacity(this.res)
        ) {
          bee.withdraw(this.hive.cells.storage.storage, this.res);
          return;
        }
        let pos = this.pos;
        if (this.pos.roomName in Game.rooms) {
          const portal = this.pos
            .findInRange(FIND_STRUCTURES, 1)
            .filter((s) => s.structureType === STRUCTURE_PORTAL)[0];
          if (portal) pos = portal.pos;
        }
        bee.goTo(pos);
        const roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 20);
        if (roomInfo.dangerlvlmax >= 2 && bee.getActiveBodyParts(HEAL) > 0)
          bee.heal(bee);
        this.checkFlee(bee, undefined, undefined, false, 200);
      }
    });
  }
}
