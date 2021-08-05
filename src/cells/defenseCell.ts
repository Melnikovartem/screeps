import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class defenseCell extends Cell {
  towers: StructureTower[];

  constructor(hive: Hive, towers: StructureTower[]) {
    super(hive, "excavationCell");

    this.towers = towers;
    console.log(towers.length);
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    // #TODO better target picking
    if (this.hive.roomTargets.length) {
      _.forEach(this.towers, (tower) => {
        let closest = tower.pos.findClosestByRange(this.hive.roomTargets);
        if (closest)
          tower.attack(closest);
      });
    }
  };
}
