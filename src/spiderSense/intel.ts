// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { profile } from "../profiler/decorator";
import { roomStates } from "../static/enums";
import { towerCoef } from "../static/utils";
import { intelFromCache, intelToCache } from "./intel-cache";
import {
  type CreepAllBattleInfo,
  getComplexStats,
  getStats,
} from "./intel-creep";
import { roomStateNatural } from "./intel-deep";
import {
  type DangerLvl,
  type Enemy,
  getIntel,
  type RoomIntelRuntime,
} from "./intel-runtime";

/** info that is exposed to managers of Apiary */
interface IntelInfoManagers {
  // #region Properties (6)

  dangerlvlmax: DangerLvl;
  enemies: Enemy[];
  roomState: roomStates;
  // maybe remove later
  safeModeEndTime: number;
  safePlace: boolean;
  towers: StructureTower[];

  // #endregion Properties (6)
  // maybe remove later
}

@profile
export class Intel {
  // #region Properties (6)

  private intelToCache = intelToCache;

  protected getIntel = getIntel;
  protected intelRoom: { [id: string]: RoomIntelRuntime } = {};
  protected stats: { [id: string]: CreepAllBattleInfo } = {};

  public getComplexStats = getComplexStats;
  public getStats = getStats;

  // #endregion Properties (6)

  // #region Public Methods (9)

  public getComplexMyStats(pos: ProtoPos, range = 3, closePadding = 0) {
    return this.getComplexStats(pos, range, closePadding, FIND_MY_CREEPS);
  }

  public getEnemy(
    pos: ProtoPos,
    lag?: number,
    filter: (
      enemies: Enemy[],
      roomInfo: IntelInfoManagers,
      pos: RoomPosition
    ) => Enemy[] = (es, ri, posInterest) =>
      es.filter(
        (e) =>
          e.dangerlvl === ri.dangerlvlmax ||
          (e.dangerlvl >= 4 && posInterest.getRangeTo(e.object) <= 5)
      )
  ) {
    if (!(pos instanceof RoomPosition)) pos = pos.pos;

    const roomInfo = this.getInfo(pos.roomName, lag);
    const enemies = filter(roomInfo.enemies, roomInfo, pos);
    if (!enemies.length) return;

    return enemies.reduce((prev, curr) => {
      let ans =
        (pos as RoomPosition).getRangeTo(curr.object) -
        (pos as RoomPosition).getRangeTo(prev.object);
      if (ans === 0) ans = prev.dangerlvl - curr.dangerlvl;
      return ans < 0 ? curr : prev;
    }).object;
  }

  public getEnemyCreep(pos: ProtoPos, lag?: number) {
    return this.getEnemy(pos, lag, (es) =>
      es.filter((e) => e.object instanceof Creep)
    ) as Creep | undefined;
  }

  public getEnemyStructure(pos: ProtoPos, lag?: number) {
    return this.getEnemy(pos, lag, (es, ri) =>
      es.filter(
        (e) =>
          (![7, 9].includes(ri.dangerlvlmax) ||
            e.dangerlvl === ri.dangerlvlmax) &&
          e.object instanceof Structure
      )
    ) as Structure | undefined;
  }

  public getFleeDist(creep: Creep, padding = 0) {
    const info = this.getStats(creep).current;
    if (info.dmgRange > padding) return 4;
    else if (info.dmgClose > padding) return 2;
    else return 0;
  }

  public getInfo(roomName: string, lag: number = 0): IntelInfoManagers {
    const intel = this.getIntel(roomName, lag);
    // to keep everything fast i also cache dangerlvlmax and towers
    // but prob can calc them here
    const safeModeEndTime = intel.battle?.safeModeEndTime || Infinity;
    // PoorMans check if it is safe in a room
    const safePlace =
      intel.dangerlvlmax < 4 ||
      (safeModeEndTime > Game.time && intel.state === roomStates.ownedByMe);

    const info: IntelInfoManagers = {
      dangerlvlmax: intel.dangerlvlmax,
      enemies: intel.enemies,
      roomState: intel.state,
      safeModeEndTime,
      towers: intel.towers,
      safePlace,
    };
    return info;
  }

  public somewhatFreshInfo(roomName: string) {
    return this.dudInfo(roomName).lastUpdatedShallow < 20;
  }

  public getRoomState(protoName: { roomName: string } | string): roomStates {
    const roomName: string =
      typeof protoName === "string" ? protoName : protoName.roomName;
    return this.dudInfo(roomName).state;
  }

  public getTowerAttack(pos: RoomPosition, lag?: number) {
    const roomInfo = this.getInfo(pos.roomName, lag);
    let ans = 0;
    _.forEach(roomInfo.towers, (t) => {
      // 20 cause 1 shot (10) doesn't do shit
      if (
        (t.isActive() && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 20) ||
        t.owner.username === "Invader"
      )
        ans += towerCoef(t, pos) * TOWER_POWER_ATTACK;
    });
    return ans;
  }

  public update() {
    this.stats = {};
    if (Game.time % 50 === 0) this.intelToCache();
  }

  // #endregion Public Methods (9)

  // #region Protected Methods (1)

  protected dudInfo(roomName: string): RoomIntelRuntime {
    if (!this.intelRoom[roomName])
      this.intelRoom[roomName] = this.runtimeIntelFromCache(roomName);
    return this.intelRoom[roomName];
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (1)

  private runtimeIntelFromCache(roomName: string): RoomIntelRuntime {
    const cached = intelFromCache(roomName);
    const state = cached.state || roomStateNatural(roomName);
    return {
      lastUpdatedShallow: -1,
      lostVision: true,
      dangerlvlmax: 0,
      enemies: [],
      towers: [],
      state,
      ...cached,
    };
  }

  // #endregion Private Methods (1)
}
