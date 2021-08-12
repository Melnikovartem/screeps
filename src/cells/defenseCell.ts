import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class defenseCell extends Cell {
  towers: StructureTower[];

  constructor(hive: Hive, towers: StructureTower[]) {
    super(hive, "defenseCell_" + hive.room.name);

    this.towers = towers;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    super.update();

    let storageCell = this.hive.cells.storageCell
    if (storageCell) {
      _.forEach(this.towers, (tower) => {
        if (tower.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= tower.store.getUsedCapacity(RESOURCE_ENERGY))
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
    // #TODO better target picking
    if (this.hive.roomTargets) {
      let roomInfo = global.Apiary.intel.getInfo(this.hive.roomName);
      if (roomInfo) // i literally check here for hull wich is never -_-
        _.forEach(this.towers, (tower) => {
          let closest = tower.pos.findClosestByRange(roomInfo!.enemies);
          if (closest)
            tower.attack(closest);
        });
    }
  };
}
