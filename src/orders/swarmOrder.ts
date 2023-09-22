import type { SwarmMaster } from "beeMasters/_SwarmMaster";
import type { Hive } from "hive/hive";

import { SWARM_ORDER_TYPES } from "./swarmOrder-masters";

const CACHE_ORDER_POS = 0;
const CACHE_ORDER_HIVE = 1;
const CACHE_ORDER_SPAWNED = 2;
const CACHE_ORDER_TYPE = 3;
const CACHE_ORDER_CREATE = 4;
const CACHE_ORDER_SPECIAL = 10;

export interface SwarmOrderInfo {
  [CACHE_ORDER_POS]: [number, number, string?];
  [CACHE_ORDER_HIVE]: string;
  [CACHE_ORDER_SPAWNED]: number;
  [CACHE_ORDER_TYPE]: keyof typeof SWARM_ORDER_TYPES;
  [CACHE_ORDER_CREATE]: number;
  [CACHE_ORDER_SPECIAL]?: any;
}

type MasterConstructor<T> = new (order: SwarmOrder<T>) => SwarmMaster<T>;

// should be created in update step
// so that even during the tick of creation master can run its own update tick
export class SwarmOrder<T> {
  // #region Properties (5)

  private _pos: RoomPosition;

  public readonly hive: Hive;
  public readonly master: SwarmMaster<T>;
  public readonly ref: string;
  public readonly type: keyof typeof SWARM_ORDER_TYPES;

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(
    ref: string,
    hive: Hive,
    pos: RoomPosition,
    type: keyof typeof SWARM_ORDER_TYPES
  ) {
    // if we have an order with same name then prev one is invalidated
    this.ref = ref;
    const possToSave: SwarmOrderInfo[0] = [pos.x, pos.y];
    if (pos.roomName !== hive.roomName) possToSave.push(pos.roomName);
    if (!this.cache)
      Memory.cache.orders[this.ref] = {
        [CACHE_ORDER_POS]: possToSave,
        [CACHE_ORDER_HIVE]: hive.roomName,
        [CACHE_ORDER_SPAWNED]: 0,
        [CACHE_ORDER_TYPE]: type,
        [CACHE_ORDER_CREATE]: Game.time,
      };
    else {
      // hande same name or smth
      const cache = Memory.cache.orders[this.ref];
      // we preserve create time and special info
      cache[CACHE_ORDER_POS] = possToSave;
      cache[CACHE_ORDER_HIVE] = hive.roomName;
      cache[CACHE_ORDER_TYPE] = type;
    }
    this.hive = hive;
    this.type = type;
    this._pos = pos;

    let master;
    if (Apiary.orders[this.ref]?.type === type) {
      // do not create new master if the ref + type is same
      master = Apiary.orders[this.ref].master as SwarmMaster<T>;
      master.parent = this;
    } else {
      const masterProto = SWARM_ORDER_TYPES[
        type
      ] as MasterConstructor<any> as MasterConstructor<T>;
      master = new masterProto(this);
    }
    this.master = master;
    Apiary.orders[this.ref] = this;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (5)

  public get pos() {
    return this._pos;
  }

  public get print() {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  // keep how many bees used up for this order
  public get spawned(): number {
    return this.cache[CACHE_ORDER_SPAWNED];
  }

  public set spawned(value) {
    this.cache[CACHE_ORDER_SPAWNED] = value;
  }

  public get special(): T {
    // failsafe (why did it fail tho)
    if (!this.cache) return this.master.defaultInfo();
    return this.cache[CACHE_ORDER_SPECIAL] as T;
  }

  public set special(value) {
    this.cache[CACHE_ORDER_SPECIAL] = value;
  }

  // #endregion Public Accessors (5)

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
    if (Apiary.orders[this.ref] === this) {
      delete Memory.cache.orders[this.ref];
      delete Apiary.orders[this.ref];
    }
    this.master.delete();
  }

  public newSpawn() {
    this.spawned = this.spawned + 1;
  }

  public setPosition(value: RoomPosition) {
    const toSave: SwarmOrderInfo[typeof CACHE_ORDER_POS] = [value.x, value.y];
    if (value.roomName !== this.hive.roomName) toSave[2] = value.roomName;
    Memory.cache.orders[this.ref][CACHE_ORDER_POS] = toSave;
    this._pos = value;
  }

  // #endregion Public Methods (3)
}
