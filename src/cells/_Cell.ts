import { Hive } from "../Hive";
import { Master } from "../beeMaster/_Master";
import { profile } from "../profiler/decorator";

@profile
export abstract class Cell {

  hive: Hive;
  ref: string;
  beeMaster: Master | undefined;
  time: number;
  pos: RoomPosition;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;
    this.time = Game.time;
    this.pos = hive.pos;

    if (Apiary.masters["master" + this.ref])
      this.beeMaster = Apiary.masters["master" + this.ref];
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update<K extends keyof Cell>(): void {
    // updating structure object to actual data
    _.forEach(Object.keys(this), (key: K) => {
      let data = this[key];
      if (data instanceof Structure || data instanceof Source || data instanceof Mineral) {
        let gameObject = Game.getObjectById(data.id)
        if (gameObject)
          this[key] = <typeof data>gameObject;
      } else if (Array.isArray(data)
        && (data[0] instanceof Structure || data[0] instanceof Source || data[0] instanceof Mineral)) {
        let new_data: (typeof data[0])[] = [];

        _.forEach(data, (structure) => {
          let gameObject = Game.getObjectById(structure.id)
          if (gameObject)
            new_data.push(gameObject);
        });

        this[key] = <typeof data>new_data;
      }
    });
  }

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>[${this.ref}]</a>`;
  }
}
