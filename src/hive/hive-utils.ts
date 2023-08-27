import { FactoryCell } from "cells/stage1/factoryCell";
import { ObserveCell } from "cells/stage2/observeCell";
import { PowerCell } from "cells/stage2/powerCell";
import { hiveStates } from "static/enums";

import type { Hive } from "./hive";

export function opt(hive: Hive) {
  const opt: TravelToOptions = { useFindRoute: true };
  if (hive.state >= hiveStates.battle) {
    opt.stuckValue = 1;
    const terrain = Game.map.getRoomTerrain(hive.roomName);
    opt.roomCallback = (roomName, matrix) => {
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
  return opt;
}

export function updateCellData(this: Hive, bake = false) {
  _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
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
        if (!this.cells.lab) return;
        this.cells.lab.laboratories[s.id] = s;
        break;
      case STRUCTURE_STORAGE:
        if (!this.cells.storage && s.isActive() && Apiary.useBucket)
          Apiary.destroyTime = Game.time;
        break;
      case STRUCTURE_FACTORY:
        if (!this.cells.factory && this.cells.storage)
          this.cells.factory = new FactoryCell(this, s);
        break;
      case STRUCTURE_POWER_SPAWN:
        if (!this.cells.power && this.cells.storage)
          this.cells.power = new PowerCell(this, s);
        break;
      case STRUCTURE_OBSERVER:
        if (!this.cells.observe) this.cells.observe = new ObserveCell(this, s);
        break;
      case STRUCTURE_TERMINAL:
        if (!this.cells.storage && s.isActive() && Apiary.useBucket)
          if (Apiary.useBucket) Apiary.destroyTime = Game.time;
        break;
    }
  });

  if (this.phase > 0 && bake) {
    this.cells.spawn.bakePriority();
    if (this.cells.lab) this.cells.lab.bakeMap();
  }
}
