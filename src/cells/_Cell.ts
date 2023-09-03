import type { Master, MasterParent } from "beeMasters/_Master";
import type { Hive } from "hive/hive";
import type { HiveCells } from "hive/hive-declarations";
import { profile } from "profiler/decorator";
import { prefix } from "static/enums";

@profile
export abstract class Cell {
  // #region Properties (3)

  public readonly hive: Hive;
  public readonly ref: string;

  public master: Master<MasterParent> | undefined = undefined;

  // #endregion Properties (3)

  // #region Constructors (1)

  public constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.ref = "cell_" + hive.room.name + "_" + cellName;

    if (Apiary.masters[prefix.master + this.ref])
      this.master = Apiary.masters[prefix.master + this.ref];
  }

  // #endregion Constructors (1)

  // #region Public Accessors (4)

  /** aliast for hive.roomName */
  public get hiveName() {
    return this.hive.roomName;
  }

  protected get sCell() {
    return this.hive.cells.storage;
  }

  public get pos(): RoomPosition {
    return this.hive.pos;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  public get refCache() {
    return Cell.refToCacheName(this.ref);
  }

  // #endregion Public Accessors (4)

  // #region Public Static Methods (1)

  public static refToCacheName(ref: string) {
    return ref.split("_")[2];
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (2)

  public delete() {
    for (const cellType in this.hive.cells)
      if (this.hive.cells[cellType as keyof HiveCells]!.ref === this.ref)
        delete this.hive.cells[cellType as keyof HiveCells];
    if (this.master) this.master.delete();
  }

  /** updates instances for objects in Cell by Game.getObjectById */
  /** do i even need this in newer versions? */
  public updateObject<K extends keyof this>(
    updateMapKey: K[] = [],
    nonforceMapKey: K[] = []
  ): void {
    // updating structure object to actual data :/

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

  // #endregion Public Methods (2)

  // #region Public Abstract Methods (2)

  /** second stage of decision making like where do i need to spawn creeps or do i need */
  public abstract run(): void;
  /** first stage of decision making */
  public abstract update(): void;

  // #endregion Public Abstract Methods (2)

  // #region Protected Methods (3)

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

  // #endregion Protected Methods (3)
}
