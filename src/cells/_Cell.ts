import { Hive } from "../Hive";
import { Master } from "../beeMasters/_Master";

import { prefix } from "../enums";

import { profile } from "../profiler/decorator";
import type { HiveCells } from "../Hive";

@profile
export abstract class Cell {
  private readonly hive: Hive;
  private readonly ref: string;
  private master: Master | undefined;

  private constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = cellName;

    if (!(this.refCache in Memory.cache.hives[this.hive.roomName].cells))
      Memory.cache.hives[this.hive.roomName].cells[this.refCache] = {};

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  private get refCache() {
    return this.ref.split("_")[0];
  }

  private get pos(): RoomPosition {
    return this.hive.pos;
  }

  private delete() {
    for (const cellType in this.hive.cells)
      if (this.hive.cells[cellType as keyof HiveCells]!.ref === this.ref)
        delete this.hive.cells[cellType as keyof HiveCells];
    if (this.master) this.master.delete();
  }

  // first stage of decision making like do i a logistic transfer do i need more masters
  private update<K extends keyof this>(
    updateMapKey: K[] = [],
    nonforceMapKey: K[] = []
  ): void {
    // updating structure object to actual data

    _.forEach(Object.keys(this), (key: K) => {
      const data = this[key];
      if (
        data instanceof Structure ||
        data instanceof Source ||
        data instanceof Mineral
      ) {
        const gameObject = Game.getObjectById(data.id);
        if (gameObject || !nonforceMapKey.includes(key))
          this[key] = gameObject as typeof data;
      }
    });

    _.forEach(updateMapKey, (key: K) => {
      for (const inMap in this[key]) {
        const data = this[key][inMap];
        const gameObject = Game.getObjectById(inMap);
        if (gameObject) this[key][inMap] = gameObject as typeof data;
        else delete this[key][inMap];
      }
    });
  }

  // second stage of decision making like where do i need to spawn creeps or do i need
  protected abstract run(): void;

  private setCahe<K extends keyof this, T extends this[K]>(
    key: K,
    baseValue: T
  ) {
    if (
      !(
        (key as string) in
        Memory.cache.hives[this.hive.roomName].cells[this.refCache]
      )
    )
      Memory.cache.hives[this.hive.roomName].cells[this.refCache][
        key as string
      ] = baseValue;
  }

  private toCache<K extends keyof this, T extends this[K]>(key: K, value: T) {
    Memory.cache.hives[this.hive.roomName].cells[this.refCache][key as string] =
      value;
  }

  private fromCache<K extends keyof this, T extends this[K]>(key: K) {
    return Memory.cache.hives[this.hive.roomName].cells[this.refCache][
      key as string
    ] as T;
  }

  private get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
