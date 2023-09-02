import type { Hive } from "hive/hive";

import type { SWARM_ORDER_TYPES } from "./swarmOrder-masters";

const CACHE_ORDER_POS = 0;
const CACHE_ORDER_HIVE = 1;
const CACHE_ORDER_SPAWNED = 2;
const CACHE_ORDER_TYPE = 3;
const CACHE_ORDEC_SPECIAL = 4;

export interface SwarmOrderInfo {
  [CACHE_ORDER_POS]: [number, number, string?];
  [CACHE_ORDER_HIVE]: string;
  [CACHE_ORDER_SPAWNED]: number;
  [CACHE_ORDER_TYPE]: keyof typeof SWARM_ORDER_TYPES;
  [CACHE_ORDEC_SPECIAL]?: any;
}

export class SwarmOrder<T> {
  // #region Properties (3)

  private _pos: RoomPosition;

  public readonly hive: Hive;
  public readonly ref: string;

  // #endregion Properties (3)

  // #region Constructors (1)

  // private readonly master: SwarmMaster<SwarmOrder<T>>;
  public constructor(
    ref: string,
    hive: Hive,
    pos: RoomPosition,
    type: keyof typeof SWARM_ORDER_TYPES
  ) {
    this.ref = ref;
    if (!this.cache)
      Memory.cache.orders[this.ref] = {
        [CACHE_ORDER_POS]: [pos.x, pos.y],
        [CACHE_ORDER_HIVE]: hive.roomName,
        [CACHE_ORDER_SPAWNED]: 0,
        [CACHE_ORDER_TYPE]: type,
      };
    this.hive = hive;
    this._pos = pos;

    // const masterProto = SWARM_ORDER_TYPES[type];
    // this.master = new masterProto(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (4)

  public get pos() {
    return this._pos;
  }

  // keep how many bees used up for this order
  public get spawned() {
    return 0;
  }

  public get special(): T {
    return this.cache[CACHE_ORDEC_SPECIAL] as T;
  }

  public set special(value) {
    this.cache[CACHE_ORDEC_SPECIAL] = value;
  }

  // #endregion Public Accessors (4)

  // #region Private Accessors (1)

  private get cache() {
    return Memory.cache.orders[this.ref];
  }

  // #endregion Private Accessors (1)

  // #region Public Static Methods (1)

  public static init() {
    // innit orders from cache
    _.forEach(Memory.cache.orders, (cache, ref) => {
      // create swarmOrder
      if (!ref) return;
      const hive = Apiary.hives[cache[CACHE_ORDER_HIVE]];
      if (!hive) return;
      const pos = cache[CACHE_ORDER_POS];
      const roomName = pos[2] || hive.roomName;
      // @todo add to Apiary?
      // const swarmOrder =
      new SwarmOrder<any>(
        ref,
        hive,
        new RoomPosition(pos[0], pos[1], roomName),
        cache[CACHE_ORDER_TYPE]
      );
    });
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (3)

  public delete() {
    delete Memory.cache.orders[this.ref];
  }

  public newSpawn() {}

  public setPosition(value: RoomPosition) {
    const toSave: SwarmOrderInfo[typeof CACHE_ORDER_POS] = [value.x, value.y];
    if (value.roomName !== this.hive.roomName) toSave[2] = value.roomName;
    Memory.cache.orders[this.ref][CACHE_ORDER_POS] = toSave;
    this._pos = value;
  }

  // #endregion Public Methods (3)
}
