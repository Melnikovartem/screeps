import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class defenseCell extends Cell {
  towers: StructureTower[] = [];

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
  }

  update() {
    super.update();

    _.forEach(this.hive.annexNames, (annexName) => {
      if (annexName in Game.rooms) {
        let roomInfo = Apiary.intel.getInfo(annexName, 10);
        if (roomInfo.enemies.length > 0 && !roomInfo.safePlace && !Game.flags["defend_" + this.hive.roomName]
          && _.filter(Game.rooms[annexName].find(FIND_FLAGS), (f) => f.color == COLOR_RED).length == 0)
          roomInfo.enemies[0].pos.createFlag("defend_" + annexName, COLOR_RED, COLOR_BLUE);
      }
    });

    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      storageCell.requestFromStorage(this.ref,
        _.filter(this.towers, (tower) => tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store[RESOURCE_ENERGY]), 0);
      storageCell.requestFromStorage(this.ref,
        _.filter(this.towers, (tower) => tower.store.getCapacity(RESOURCE_ENERGY) > tower.store[RESOURCE_ENERGY]), 0);
    }
  };

  run() {
    let roomInfo = Apiary.intel.getInfo(this.hive.roomName, 10);
    if (!roomInfo.safePlace) {
      roomInfo = Apiary.intel.getInfo(this.hive.roomName);
      if (roomInfo.enemies.length > 0) {
        if (this.towers.length == 0) {
          if (this.hive.stage < 2) {
            if (!Game.flags["defend_" + this.hive.roomName]
              && _.filter(Game.rooms[this.hive.roomName].find(FIND_FLAGS), (f) => f.color == COLOR_RED).length == 0)
              roomInfo.enemies[0].pos.createFlag("defend_" + this.pos.roomName, COLOR_RED, COLOR_BLUE);
          } else
            this.hive.room.controller!.activateSafeMode(); // red button
        } else
          _.forEach(this.towers, (tower) => {
            let closest = tower.pos.findClosestByRange(roomInfo!.enemies);
            if (closest && (tower.pos.getRangeTo(closest) < 15 || (closest instanceof Creep && closest.owner.username == "Invader")))
              tower.attack(closest);
          });
      }
    }
  };
}
