import { DevelopmentCell } from "cells/stage0/developmentCell";
import { FactoryCell } from "cells/stage1/factoryCell";
import { LaboratoryCell } from "cells/stage1/laboratoryCell";
import { CorridorMiningCell } from "cells/stage2/corridorMining";
import { ObserveCell } from "cells/stage2/observeCell";
import { PowerCell } from "cells/stage2/powerCell";
import { hiveStates } from "static/enums";

import type { Hive } from "./hive";
import { LOW_ENERGY } from "cells/management/storageCell";

export function opt(hive: Hive) {
  const optHive: TravelToOptions = { useFindRoute: true };
  if (hive.state >= hiveStates.battle) {
    optHive.stuckValue = 1;
    const terrain = Game.map.getRoomTerrain(hive.roomName);
    optHive.roomCallback = (roomName, matrix) => {
      if (roomName !== hive.roomName) return;
      const enemies = Apiary.intel
        .getInfo(roomName, 10)
        .enemies.map((e) => e.object);
      _.forEach(enemies, (c) => {
        let fleeDist = 0;
        if (c instanceof Creep) fleeDist = Apiary.intel.getFleeDist(c);
        if (!fleeDist) return;
        _.forEach(c.pos.getPositionsInRange(fleeDist), (p) => {
          if (
            p
              .lookFor(LOOK_STRUCTURES)
              .filter(
                (s) =>
                  s.structureType === STRUCTURE_RAMPART &&
                  (s as StructureRampart).my &&
                  s.hits > 10000
              ).length
          )
            return;
          let value = p
            .lookFor(LOOK_STRUCTURES)
            .filter((s) => s.structureType === STRUCTURE_ROAD).length
            ? 0x20
            : terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP
            ? 0x40
            : 0x30;
          if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL) value = 0xff; // idk why but sometimes the matrix is not with all walls...
          if (matrix.get(p.x, p.y) < value) matrix.set(p.x, p.y, value);
        });
        matrix.set(c.pos.x, c.pos.y, 0xff);
      });
      return matrix;
    };
  }
  return optHive;
}

export function updateCellData(this: Hive, bake = false) {
  _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
    if (!s.isActive()) return;
    switch (s.structureType) {
      case STRUCTURE_EXTENSION:
        this.cells.spawn.extensions[s.id] = s;
        break;
      case STRUCTURE_SPAWN:
        this.cells.spawn.spawns[s.id] = s;
        break;
      case STRUCTURE_TOWER:
        this.cells.defense.towers[s.id] = s;
        break;
      case STRUCTURE_LAB:
        // creating cell even from one lab so that we can boost
        if (!this.cells.lab) this.cells.lab = new LaboratoryCell(this);
        this.cells.lab.laboratories[s.id] = s;
        break;
      case STRUCTURE_FACTORY:
        if (!this.cells.factory) this.cells.factory = new FactoryCell(this, s);
        break;
      case STRUCTURE_POWER_SPAWN:
        if (!this.cells.power) this.cells.power = new PowerCell(this, s);
        break;
      case STRUCTURE_OBSERVER:
        if (!this.cells.observe) this.cells.observe = new ObserveCell(this, s);
        break;
      case STRUCTURE_STORAGE:
      case STRUCTURE_TERMINAL:
        break;
    }
  });

  switch (this.phase) {
    case 2:
      this.cells.corridorMining = new CorridorMiningCell(this);
    // @TODO nukes
    // fall through
    case 1:
      if (
        this.room.storage &&
        this.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <
          LOW_ENERGY.low
      )
        this.cells.dev = new DevelopmentCell(this);
      break;
    case 0:
      this.cells.dev = new DevelopmentCell(this);
      break;
  }

  if (!this.cells.dev && !Object.keys(this.cells.spawn.spawns).length)
    this.cells.dev = new DevelopmentCell(this);

  if (this.phase > 0 && bake) {
    this.cells.spawn.bakePriority();
    if (this.cells.lab) this.cells.lab.bakeMap();
  }
}
