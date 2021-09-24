import { Hive } from "../Hive";
import { Master } from "../beeMasters/_Master";

import { prefix } from "../enums";

import { profile } from "../profiler/decorator";

@profile
export abstract class Cell {

  hive: Hive;
  ref: string;
  master: Master | undefined;
  time: number;
  pos: RoomPosition;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;
    this.time = Game.time;
    this.pos = hive.pos;

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  // first stage of decision making like do i a logistic transfer do i need more masters
  update<K extends keyof this>(updateMapKey: K[] = [], force: boolean = true): void {
    // updating structure object to actual data
    _.forEach(Object.keys(this), (key: K) => {
      let data = this[key];
      if (data instanceof Structure || data instanceof Source || data instanceof Mineral) {
        let gameObject = Game.getObjectById(data.id);
        if (force || gameObject)
          this[key] = <typeof data>gameObject;
      }
    });

    if (updateMapKey)
      _.forEach(updateMapKey, (key: K) => {
        for (const inMap in this[key]) {
          let data = this[key][inMap];
          if (data instanceof Structure || data instanceof Source || data instanceof Mineral) {
            let gameObject = Game.getObjectById(data.id);
            if (gameObject)
              this[key][inMap] = <typeof data>gameObject;
            else if (force)
              delete this[key][inMap];
          }
        }
      });
  }

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
