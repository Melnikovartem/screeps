/**
 * Import statements
 */
import type { CompressedRoom } from "antBrain/hivePlanner/planner-active";
import type { Cell } from "cells/_Cell";
import { DefenseCell } from "cells/base/defenseCell";
import { ExcavationCell } from "cells/base/excavationCell";
import { BuildCell } from "cells/building/buildCell";
import { AnnexCell } from "cells/management/annexCell";
import { HIVE_ENERGY, StorageCell } from "cells/management/storageCell";
import { UpgradeCell } from "cells/management/upgradeCell";
import { RespawnCell } from "cells/spawning/respawnCell";
import { BASE_MINERALS, BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import type { SWARM_MASTER } from "orders/swarm-nums";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { APPROX_PROFIT_SOURCE, BASE_MODE_HIVE } from "static/constants";
import { hiveStates, prefix } from "static/enums";

import type { HiveCells, ResTarget } from "./hive-declarations";
import { addResourceCells } from "./hive-mining";
import { opt, updateCellData } from "./hive-utils";

// Constant for a minimum amount of a certain mineral in the hive
const HIVE_MINERAL = 5000;

// Decorator to profile class methods
@profile
export class Hive {
  // #region Properties (12)

  /** List of annex names */
  private _annexNames: string[];
  private updateCellData = updateCellData;

  /** Configuration of different cell types within the hive */
  public readonly cells: HiveCells;
  /** Hive room name */
  public readonly roomName: string;

  /** added all resources from cache */
  public allResources = false;
  /** List of annexes in danger */
  public bassboost: Hive | null = null;
  public mastersResTarget: ResTarget = {};
  public resState: { energy: number } & ResTarget = { energy: 0 };
  public resTarget: { energy: number } & ResTarget = {
    // energy
    [RESOURCE_ENERGY]: HIVE_ENERGY,
    [BOOST_MINERAL.build[2]]: HIVE_MINERAL * 2,
    // cheap but good
    // [BOOST_MINERAL.fatigue[0]]: HIVE_MINERAL / 2,
    // [BOOST_MINERAL.build[0]]: HIVE_MINERAL,
    // [BOOST_MINERAL.attack[0]]: HIVE_MINERAL,
    // [BOOST_MINERAL.damage[1]]: HIVE_MINERAL,
    // [BOOST_MINERAL.attack[1]]: HIVE_MINERAL,
  };
  /** The main room controlled by the hive */
  public room: Room;
  public shortages: ResTarget = {};
  public state: hiveStates = hiveStates.economy;

  // #endregion Properties (12)

  // #region Constructors (1)

  /**
   * Constructor for the Hive class
   * @param {string} roomName - The name of the hive's main room
   */
  public constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];

    if (!this.cache) Hive.initMemory(this.roomName);
    this._annexNames = this.cache.annex;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new RespawnCell(this),
      defense: new DefenseCell(this),
      excavation: new ExcavationCell(this),
      build: new BuildCell(this),
      storage: new StorageCell(this),
      upgrade: new UpgradeCell(this),
      annex: new AnnexCell(this),
    };

    if (!this.controller) return;

    switch (this.phase) {
      case 2:
        // hihgh lvl minerals to protect my hive
        this.resTarget[BOOST_MINERAL.attack[2]] = HIVE_MINERAL;
        // protect expansions with boost creeps + more attack
        this.resTarget[BOOST_MINERAL.heal[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.rangedAttack[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.damage[2]] = HIVE_MINERAL * 2;
        this.resTarget[BOOST_MINERAL.fatigue[2]] = HIVE_MINERAL * 2;
        /* if (this.mode.saveCpu) used to boost creeps
          this.resTarget[BOOST_MINERAL.harvest[0]] = HIVE_MINERAL; */

        // save energy for a bad day
        this.resTarget[RESOURCE_BATTERY] = 5000;
        break;
      case 1:
        // try to develop the hive
        this.resTarget[BOOST_MINERAL.upgrade[2]] = HIVE_MINERAL;
        // to prottect
        this.resTarget[BOOST_MINERAL.attack[2]] = HIVE_MINERAL;
        break;
      case 0:
        break;
    }

    // creates all optional cells based on objectives
    this.updateCellData(true);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (14)

  public get allRoomNames() {
    return [this.roomName].concat(this.annexNames);
  }

  public get annexInDanger() {
    return this.cells.annex.annexInDanger;
  }

  public get annexNames() {
    return this._annexNames;
  }

  public get approxIncome() {
    let income = 0;
    _.forEach(this.cells.excavation.resourceCells, (s) => {
      if (s.resType === RESOURCE_ENERGY && s.operational)
        income += s.link
          ? APPROX_PROFIT_SOURCE.link
          : APPROX_PROFIT_SOURCE.hauling;
    });
    return Math.max(1, income);
  }

  /** fast way to get to cache */
  public get cache() {
    return Memory.cache.hives[this.roomName];
  }

  /** controller of the room */
  public get controller() {
    return (
      this.room.controller! ||
      ({
        pos: new RoomPosition(25, 25, this.roomName),
        level: 0,
      } as StructureController)
    );
  }

  public get isBattle() {
    return this.state >= hiveStates.battle;
  }

  /** Interface for settings of hive */
  public get mode() {
    return this.cache.do;
  }

  /** custom pathing during battle to aviod enemies */
  public get opt() {
    return opt(this);
  }

  /** Current development phase of the hive *
   *
   * 0 up to storage tech
   *
   * 1 storage to 7lvl
   *
   * 2 end game aka 8lvl
   *
   * max */
  public get phase(): 0 | 1 | 2 {
    const activeStorage = this.room.storage && this.room.storage.isActive();
    if (!activeStorage) return 0;
    if (this.controller.level < 8) return 1;
    return 2;
  }

  /** central position of hive */
  public get pos() {
    if (this.cells) return this.cells.defense.pos;
    const poss = this.cache.cells[prefix.defenseCell]?.poss as Pos | undefined;
    if (poss) return new RoomPosition(poss.x, poss.y, this.roomName);
    return this.controller.pos;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.roomName}"]</a>`;
  }

  /** pos to rest and wait in this hive */
  public get rest() {
    return this.cells.excavation.pos;
  }

  public get storage() {
    return this.cells.storage.storage;
  }

  // #endregion Public Accessors (14)

  // #region Public Static Methods (1)

  public static initMemory(roomName: string) {
    // @TODO power/deposit mining if on the edge
    Memory.cache.hives[roomName] = {
      annex: [],
      cells: {},
      do: { ...BASE_MODE_HIVE },
    };
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (8)

  public canBuy(res: ResourceConstant) {
    let canBuyIn = false;
    switch (this.mode.buyIn) {
      case 4:
        canBuyIn = true;
        break;
      case 3:
        if (res === RESOURCE_ENERGY) canBuyIn = true;
      // fall through
      case 2:
        if (res === RESOURCE_OPS) canBuyIn = true;
      // fall through
      case 1:
        if (BASE_MINERALS.includes(res)) canBuyIn = true;
        break;
      case 0:
        break;
    }
    return canBuyIn;
  }

  public createSwarm<T>(
    ref: string,
    pos: RoomPosition,
    type: SWARM_MASTER,
    info?: Partial<T>
  ) {
    // do not create duplicate
    const existing = Apiary.orders[ref];
    if (existing && existing.type === type) return existing as SwarmOrder<T>;
    // bug prone, but best what i could think of
    // if you don't fuckup with defaultInfo in swarm master should be ok
    // (as it would it set it to T so special would be have some object behind it)
    // swarmOrder can handle to some extend duplicate order
    const order = new SwarmOrder<T>(ref, this, pos, type);
    for (const key in info) (order.special as Partial<T>)[key] = info[key];
    return order;
  }

  public getResState(res: ResourceConstant) {
    return this.resState[res] || 0;
  }

  public getUsedCapacity(res: ResourceConstant) {
    return this.cells.storage.getUsedCapacity(res);
  }

  public roomPlanner(
    roomName: string = this.roomName
  ): CompressedRoom | undefined {
    return Memory.longterm.roomPlanner[this.roomName]?.rooms[roomName];
  }

  public run() {
    _.forEach(this.cells, (cell: Cell) => {
      Apiary.wrap(() => cell.run(), cell.ref, "run");
    });
  }

  /**
   * Handle changes in hive state
   * @param {keyof typeof hiveStates} state - The new state of the hive
   * @param {boolean} trigger - Whether the change was triggered
   */
  public stateChange(state: keyof typeof hiveStates, trigger: boolean) {
    const st = hiveStates[state];
    if (trigger) {
      if (st > this.state) this.state = st;
    } else if (this.state === st) this.state = hiveStates.economy;
  }

  public update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];

    this.mastersResTarget = {};

    if (
      Apiary.intTime % 1500 === 1499 ||
      this.cells.spawn.recordedCapacity !== this.room.energyCapacityAvailable
    )
      this.updateCellData();

    if (!this.allResources && Apiary.intTime % 10 === 0) addResourceCells(this);

    // ask for help
    if (
      this.state === hiveStates.nospawn ||
      (this.state === hiveStates.lowenergy &&
        (!this.cells.storage ||
          this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) < 5000))
    ) {
      const validHives = _.filter(
        Apiary.hives,
        (h) =>
          h.roomName !== this.roomName &&
          h.state === hiveStates.economy &&
          this.pos.getRoomRangeTo(h) <= 13 &&
          h.phase > 0
      );
      if (validHives.length)
        this.pos.createFlag(
          prefix.boost + this.roomName,
          COLOR_PURPLE,
          COLOR_WHITE
        );
    }

    _.forEach(this.cells, (cell: Cell) => {
      Apiary.wrap(() => cell.update(), cell.ref, "update");
    });
  }

  // #endregion Public Methods (8)
}
