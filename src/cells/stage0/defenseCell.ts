import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class defenseCell extends Cell {
  towers: StructureTower[] = [];

  constructor(hive: Hive) {
    super(hive, "DefenseCell_" + hive.room.name);
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    super.update();

    _.forEach(this.hive.annexNames, (annexName) => {
      let roomInfo = global.Apiary.intel.getInfo(annexName, 10);
      if (roomInfo.enemies.length > 0 && !Game.flags["defend_" + this.hive.roomName])
        roomInfo.enemies[0].pos.createFlag("defend_" + annexName, COLOR_RED, COLOR_BLUE);
    });

    let storageCell = this.hive.cells.storageCell
    if (storageCell) {
      _.forEach(this.towers, (tower) => {
        if (tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store[RESOURCE_ENERGY])
          storageCell!.requests[tower.id] = {
            from: storageCell!.storage,
            to: tower,
            resource: RESOURCE_ENERGY,
            priority: 0,
          };
        else if (!storageCell!.requests[tower.id] && tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
          storageCell!.requests[tower.id] = {
            from: storageCell!.storage,
            to: tower,
            resource: RESOURCE_ENERGY,
            priority: 5,
          };
      });
    }
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    let roomInfo = global.Apiary.intel.getInfo(this.hive.roomName, 5);
    if (roomInfo.enemies.length)
      if (this.towers.length == 0) {
        if (this.hive.stage < 2)
          this.pos.createFlag("defend_" + this.pos.roomName, COLOR_RED, COLOR_BLUE);
        else
          this.hive.room.controller!.activateSafeMode(); // red button
      } else
        _.forEach(this.towers, (tower) => {
          let closest = tower.pos.findClosestByRange(roomInfo!.enemies);
          if (closest)
            tower.attack(closest);
        });
  };
}
