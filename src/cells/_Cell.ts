import { Hive } from "../Hive";
import { Master } from "../beeMasters/_Master";

import { prefix } from "../enums";

import { profile } from "../profiler/decorator";

@profile
export abstract class Cell {

  readonly hive: Hive;
  readonly ref: string;
  master: Master | undefined;
  readonly time: number;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;
    this.time = Game.time;

    if (!(this.ref in Memory.cache.hives[this.hive.roomName].cells))
      Memory.cache.hives[this.hive.roomName].cells[this.ref] = {};

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  get pos() {
    return this.hive.getPos("center");
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
          } else if (data === null) {
            let gameObject = Game.getObjectById(inMap);
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

  /* toCache<K extends keyof this>(keys: K[]) {
    Memory.cache.hives[this.hive.roomName].cells[this.ref] = {}
    let cellData = Memory.cache.hives[this.hive.roomName].cells[this.ref];
    _.forEach(keys, k => {
      (<{ [id: string]: any }>cellData)[<string>k] = this[k];
    });
  }*/

  setCahe<K extends keyof this, T extends this[K]>(key: K, baseValue: T) {
    if (!(<string>key in Memory.cache.hives[this.hive.roomName].cells[this.ref]))
      Memory.cache.hives[this.hive.roomName].cells[this.ref][<string>key] = baseValue;
  }

  toCache<K extends keyof this, T extends this[K]>(key: K, value: T) {
    Memory.cache.hives[this.hive.roomName].cells[this.ref][<string>key] = value;
  }

  fromCache<K extends keyof this, T extends this[K]>(key: K) {
    return <T>Memory.cache.hives[this.hive.roomName].cells[this.ref][<string>key];
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
