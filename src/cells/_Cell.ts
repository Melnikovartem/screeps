import { Hive } from "../Hive";
import { Master } from "../beeMaster/_Master";

export abstract class Cell {

  hive: Hive;
  ref: string;
  beeMaster: Master | undefined;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update<K extends keyof Cell>(): void {
    // updating structure object to actual data
    _.forEach(Object.keys(this), (key: K) => {
      let structure = this[key];
      if (structure instanceof Structure)
        this[key] = <typeof structure>Game.getObjectById(structure.id);
    });
  }

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;

  print(info: any) {
    console.log(Game.time, "!", this.ref, "?", info);
  }
}
