import type { MovePriority } from "beeMasters/_Master";
import { setups } from "bees/creepSetups";
import { COMPLEX_COMMODITIES } from "cells/stage1/factoryCell";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

// this will become outdated soon

const HAUL_PER_TRIP = 1_000;

@profile
export class PortalMaster extends SwarmMaster<undefined> {
  // #region Properties (6)

  private commodities = false;

  public cycle: number = CREEP_LIFE_TIME;
  public override movePriority: MovePriority = 4;
  public priority: 2 | 9 = 9;
  public res: ResourceConstant | undefined;
  public setup = setups.puppet;

  // #endregion Properties (6)

  // #region Constructors (1)

  public constructor(order: SwarmOrder<undefined>) {
    super(order);
    if (this.parent.ref.includes(prefix.boost)) {
      this.setup = setups.bootstrap.copy();
      this.setup.patternLimit += 4;
    } else if (this.parent.ref.includes(prefix.claim)) {
      this.setup = setups.claimer;
      this.cycle = CREEP_CLAIM_LIFE_TIME;
    } else if (this.parent.ref.includes(prefix.reserve)) {
      this.setup = setups.claimer.copy();
      this.setup.patternLimit += 2;
    } else if (this.parent.ref.includes("defense")) {
      this.setup = setups.defender.destroyer.copy();
    } else if (this.parent.ref.includes("harass")) {
      this.setup = setups.archer.copy();
      this.setup.fixed = [HEAL, ATTACK];
      this.setup.patternLimit = 3;
    } else if (this.parent.ref.includes("transfer")) {
      this.setup = setups.hauler.copy();
      const parsed = /transfer_(.*)/.exec(this.parent.ref);
      if (parsed) this.res = parsed[1] as ResourceConstant;
      this.commodities = COMPLEX_COMMODITIES.includes(
        this.res as CommodityConstant
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

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public override get maxSpawns(): number {
    return Infinity;
  }

  public override get targetBeeCount(): number {
    if (!this.res) return 1;
    const inStore = this.hive.resState[this.res] || 0;
    return inStore >= HAUL_PER_TRIP * 3 ? 2 : 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    this.preRunBoost();
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.chill) {
        if (
          this.res &&
          bee.store.getFreeCapacity(this.res) &&
          this.hive.storage &&
          this.hive.storage.store.getUsedCapacity(this.res)
        ) {
          bee.withdraw(this.hive.storage, this.res);
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

  public override update() {
    super.update();

    let shouldSpawn = Game.time >= this.oldestSpawn + this.cycle - 100;
    if (!this.beesAmount && this.res) {
      if (this.hive.phase < 1 || !this.hive.storage) {
        this.parent.delete();
        return;
      }
      if (
        this.ref.includes("nokeep") &&
        !this.hive.storage.store.getUsedCapacity(this.res)
      ) {
        this.parent.delete();
        return;
      }

      const inStore = this.hive.cells.storage.storageUsedCapacity(this.res);
      shouldSpawn = inStore >= HAUL_PER_TRIP;
    }

    if (this.pos.roomName in Game.rooms) {
      let portal = this.pos
        .findInRange(FIND_STRUCTURES, 1)
        .filter((s) => s.structureType === STRUCTURE_PORTAL)[0];
      if (!portal) {
        portal = Game.rooms[this.pos.roomName]
          .find(FIND_STRUCTURES)
          .filter((s) => s.structureType === STRUCTURE_PORTAL)[0];
        if (portal) this.parent.setPosition(portal.pos);
        else this.parent.delete();
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

  // #endregion Public Methods (2)

  // #region Protected Methods (1)

  protected override defaultInfo(): undefined {
    return undefined;
  }

  // #endregion Protected Methods (1)
}
