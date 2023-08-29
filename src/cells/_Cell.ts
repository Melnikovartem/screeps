import { Master } from "../beeMasters/_Master";
import type { HiveCells } from "../hive/hive";
import { Hive } from "../hive/hive";
import { profile } from "../profiler/decorator";
import { prefix } from "../static/enums";

@profile
export abstract class Cell {
  public readonly hive: Hive;
  public readonly ref: string;
  public master: Master | undefined;

  public constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = "cell_" + hive.room.name + "_" + cellName;

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  public static refToCacheName(ref: string) {
    return ref.split("_")[2];
  }

  public get refCache() {
    return Cell.refToCacheName(this.ref);
  }

  public get pos(): RoomPosition {
    return this.hive.pos;
  }

  public get roomName() {
    return this.hive.roomName;
  }

  public delete() {
    for (const cellType in this.hive.cells)
      if (this.hive.cells[cellType as keyof HiveCells]!.ref === this.ref)
        delete this.hive.cells[cellType as keyof HiveCells];
    if (this.master) this.master.delete();
  }

  // first stage of decision making like do i a logistic transfer do i need more masters
  public update<K extends keyof this>(
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
  public abstract run(): void;

  /** access up in the cache of the class
   * caution when using undefined. prefered method is to set to null
   *
   * value needs to be declared first
   *
   * get: cache(param)
   *
   * set: cache(param, value)
   */
  protected cache<K extends keyof this, T extends this[K]>(key: K): T | null;
  protected cache<K extends keyof this, T extends this[K]>(key: K, value: T): T;
  protected cache<K extends keyof this, T extends this[K]>(
    key: K,
    value?: T
  ): T | null {
    if (!this.hive.cache.cells[this.refCache])
      this.hive.cache.cells[this.refCache] = {};
    const mem = this.hive.cache.cells[this.refCache];
    if (value !== undefined) {
      mem[key as string] = value;
      return value as T;
    }
    return (mem[key as string] as T | undefined) || null;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
