import { Hive } from "../Hive";
import { Master } from "../beeMasters/_Master";

import { prefix } from "../enums";

import { profile } from "../profiler/decorator";
import type { HiveCells } from "../Hive";


@profile
export abstract class Cell {

  readonly hive: Hive;
  readonly ref: string;
  master: Master | undefined;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;

    if (!(this.refCache in Memory.cache.hives[this.hive.roomName].cells))
      Memory.cache.hives[this.hive.roomName].cells[this.refCache] = {};

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  get refCache() {
    return this.ref.split("_")[0];
  }

  get pos(): RoomPosition {
    return this.hive.pos;
  }

  delete() {
    for (let cellType in this.hive.cells)
      if (this.hive.cells[<keyof HiveCells>cellType]!.ref === this.ref)
        delete this.hive.cells[<keyof HiveCells>cellType];
    if (this.master)
      this.master.delete();
  }

  // first stage of decision making like do i a logistic transfer do i need more masters
  update<K extends keyof this>(updateMapKey: K[] = [], nonforceMapKey: K[] = []): void {
    // updating structure object to actual data

    _.forEach(Object.keys(this), (key: K) => {
      let data = this[key];
      if (data instanceof Structure || data instanceof Source || data instanceof Mineral) {
        let gameObject = Game.getObjectById(data.id);
        if (gameObject || !nonforceMapKey.includes(key))
          this[key] = <typeof data>gameObject;
      }
    });

    _.forEach(updateMapKey, (key: K) => {
      for (const inMap in this[key]) {
        let data = this[key][inMap];
        let gameObject = Game.getObjectById(inMap);
        if (gameObject)
          this[key][inMap] = <typeof data>gameObject;
        else
          delete this[key][inMap];
      }
    });
  }

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;

  setCahe<K extends keyof this, T extends this[K]>(key: K, baseValue: T) {
    if (!(<string>key in Memory.cache.hives[this.hive.roomName].cells[this.refCache]))
      Memory.cache.hives[this.hive.roomName].cells[this.refCache][<string>key] = baseValue;
  }

  toCache<K extends keyof this, T extends this[K]>(key: K, value: T) {
    Memory.cache.hives[this.hive.roomName].cells[this.refCache][<string>key] = value;
  }

  fromCache<K extends keyof this, T extends this[K]>(key: K) {
    return <T>Memory.cache.hives[this.hive.roomName].cells[this.refCache][<string>key];
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
