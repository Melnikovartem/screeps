/**
 * Import statements
 */
import type { HiveCache } from "abstract/hiveMemory";
import { BASE_MODE_HIVE } from "abstract/hiveMemory";
import { PullerMaster } from "beeMasters/corridorMining/puller";
import { BuilderMaster } from "beeMasters/economy/builder";
import type { CreepSetup } from "bees/creepSetups";
import { FULL_CAPACITY } from "bugSmuggling/terminalNetwork";
import type { Cell } from "cells/_Cell";
import { DefenseCell } from "cells/base/defenseCell";
import { ExcavationCell } from "cells/base/excavationCell";
import { RespawnCell } from "cells/base/respawnCell";
import { DevelopmentCell } from "cells/stage0/developmentCell";
import { FactoryCell } from "cells/stage1/factoryCell";
import { BOOST_MINERAL, LaboratoryCell } from "cells/stage1/laboratoryCell";
import {
  ENERGY_FOR_REVERTING_TO_DEV_CELLS,
  HIVE_ENERGY,
  StorageCell,
} from "cells/stage1/storageCell";
import { UpgradeCell } from "cells/stage1/upgradeCell";
import { ObserveCell } from "cells/stage2/observeCell";
import { PowerCell } from "cells/stage2/powerCell";
import { profile } from "profiler/decorator";
import { WALLS_START } from "static/constants";
import { hiveStates, prefix } from "static/enums";

import { getBuildTarget, updateStructures } from "./hive-building";
import { addAnex, markResources, updateDangerAnnex } from "./hive-mining";
import { opt, updateCellData } from "./hive-utils";
// Import various modules and types

// Define the SpawnOrder interface for creep spawning
export interface SpawnOrder {
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // Priority of the creep
  master: string;
  ref: string;
  createTime: number;
}

// Define the BuildProject interface for construction projects
export interface BuildProject {
  pos: RoomPosition;
  sType: StructureConstant;
  targetHits: number;
  energyCost: number;
  type: "repair" | "construction";
}

// Define the HiveCells interface for different cell types within a hive
export interface HiveCells {
  storage?: StorageCell;
  defense: DefenseCell;
  spawn: RespawnCell;
  upgrade?: UpgradeCell;
  excavation: ExcavationCell;
  dev?: DevelopmentCell;
  lab?: LaboratoryCell;
  factory?: FactoryCell;
  observe?: ObserveCell;
  power?: PowerCell;
}

// Define a type for resource targets
export type ResTarget = { [key in ResourceConstant]?: number };

// Constant for a minimum amount of a certain mineral in the hive
const HIVE_MINERAL = 5000;

// Constants for update intervals
const UPDATE_STRUCTURES_BATTLE = 100;
const UPDATE_STRUCTURES_NORMAL = 1500;

// Decorator to profile class methods
@profile
export class Hive {
  /** Hive room name */
  public readonly roomName: string;
  /** List of annex names */
  public annexNames: string[] = [];
  /** List of annexes in danger */
  public annexInDanger: string[] = [];

  /** The main room controlled by the hive */
  public room: Room;
  /** Configuration of different cell types within the hive */
  public readonly cells: HiveCells;

  /** Dictionary of spawn orders */
  public spawOrders: { [id: string]: SpawnOrder } = {};

  /** BuilderMaster instance for managing building-related tasks */
  public readonly builder?: BuilderMaster;
  /** PullerMaster instance for managing resource transportation */
  public readonly puller?: PullerMaster;

  /** Current development phase of the hive *
   *
   * 0 up to storage tech
   *
   * 1 storage to 7lvl
   *
   * 2 end game aka 8lvl
   *
   * max */
  public readonly phase: 0 | 1 | 2;

  /** How much of buildings and resources to recheck
   *
   * 3
   *
   * 2
   *
   * 1
   *
   * 0 nothing
   */
  public shouldRecalc: 0 | 1 | 2 | 3;
  public bassboost: Hive | null = null;

  public structuresConst: BuildProject[] = [];
  /** sum of construction cost */
  public sumCost = {
    hive: 0,
    annex: 0,
  };

  /** current minium wall health */
  private minCurWallHealth = 0;
  public wallTargetHealth = WALLS_START;

  public state: hiveStates = hiveStates.economy;

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
  public resState: { energy: number } & ResTarget = { energy: 0 };
  public mastersResTarget: ResTarget = {};
  public shortages: ResTarget = {};

  /**
   * Constructor for the Hive class
   * @param {string} roomName - The name of the hive's main room
   */
  public constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];

    if (!this.cache) Hive.initMemory(this.roomName);

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new RespawnCell(this),
      defense: new DefenseCell(this),
      excavation: new ExcavationCell(this),
    };

    /** How much to check when rechecking buildings
     *
     * 3
     *
     * 2
     *
     * 1
     *
     * 0 no need
     */
    this.shouldRecalc = 3;
    this.phase = 0;
    if (!this.controller) return;

    const storage = this.room.storage || this.room.terminal;
    if (storage && storage.isActive()) {
      this.phase = 1;
      if (
        this.room.storage &&
        this.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <
          ENERGY_FOR_REVERTING_TO_DEV_CELLS * 1.5
      )
        this.cells.dev = new DevelopmentCell(this);
      const sCell = new StorageCell(this, storage);
      this.cells.storage = sCell;
      this.cells.upgrade = new UpgradeCell(this, this.controller, sCell);
      this.cells.lab = new LaboratoryCell(this, sCell);

      this.builder = new BuilderMaster(this, sCell);
      let factory: StructureFactory | undefined;
      _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
        if (s.structureType === STRUCTURE_FACTORY) factory = s;
      });
      if (factory) this.cells.factory = new FactoryCell(this, factory, sCell);
      if (this.controller.level < 8) {
        // try to develop the hive
        this.resTarget[BOOST_MINERAL.upgrade[2]] = HIVE_MINERAL;
      } else {
        this.phase = 2;
        this.puller = new PullerMaster(this);

        // hihgh lvl minerals to protect my hive
        this.resTarget[BOOST_MINERAL.attack[2]] = HIVE_MINERAL * 2;

        if (this.shouldDo("saveCpu"))
          this.resTarget[BOOST_MINERAL.harvest[0]] = HIVE_MINERAL;

        // protect expansions with boost creeps + more attack
        this.resTarget[BOOST_MINERAL.heal[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.rangedAttack[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.damage[2]] = HIVE_MINERAL * 2;
        this.resTarget[BOOST_MINERAL.fatigue[2]] = HIVE_MINERAL * 2;

        // save energy for a bad day
        this.resTarget[RESOURCE_BATTERY] = 5000;

        let obeserver: StructureObserver | undefined;
        let powerSpawn: StructurePowerSpawn | undefined;
        _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
          if (s.structureType === STRUCTURE_OBSERVER) obeserver = s;
          else if (s.structureType === STRUCTURE_POWER_SPAWN) powerSpawn = s;
        });
        if (obeserver) this.cells.observe = new ObserveCell(this, obeserver);
        if (powerSpawn)
          this.cells.power = new PowerCell(this, powerSpawn, sCell);
        // @TODO cause i haven' reached yet
      }
    } else {
      this.cells.dev = new DevelopmentCell(this);
    }

    this.updateCellData(true);
    if (!this.cells.dev && !Object.keys(this.cells.spawn.spawns).length)
      this.cells.dev = new DevelopmentCell(this);
  }

  public static initMemory(roomName: string) {
    // @TODO power/deposit mining if on the edge
    Memory.cache.hives[roomName] = {
      cells: {},
      do: { ...BASE_MODE_HIVE },
    };
  }

  /**
   * Check if a specific action should be performed by the hive
   * @param {keyof HiveCache["do"]} action - The action to check
   * @returns {boolean} - Whether the action should be performed
   */
  public shouldDo(action: keyof HiveCache["do"]) {
    return this.cache.do[action];
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

  public addAnex = addAnex;
  private updateDangerAnnex = updateDangerAnnex;
  private markResources = markResources;

  private updateCellData = updateCellData;

  public getBuildTarget = getBuildTarget;
  private updateStructures = updateStructures;

  /** central position of hive */
  public get pos() {
    return this.cells.defense.pos;
  }

  /** pos to rest and wait in this hive */
  public get rest() {
    return this.cells.excavation.pos;
  }

  /** controller of the room */
  public get controller() {
    return this.room.controller!;
  }

  /** custom pathing during battle to aviod enemies */
  public get opt() {
    return opt(this);
  }

  /** fast way to get to cache */
  public get cache() {
    return Memory.cache.hives[this.roomName];
  }

  public update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];

    this.mastersResTarget = {};

    // ask for boost
    if (
      (this.state === hiveStates.nospawn ||
        (this.state === hiveStates.lowenergy &&
          (!this.cells.storage ||
            this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) < 5000))) &&
      !Apiary.orders[prefix.boost + this.roomName]
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

    // check if hive storage is full
    if (
      this.cells.storage &&
      this.cells.storage.storage.store.getFreeCapacity() <=
        FULL_CAPACITY * 0.5 &&
      !Apiary.orders[prefix.clear + this.roomName]
    )
      this.pos.createFlag(
        prefix.clear + this.roomName,
        COLOR_ORANGE,
        COLOR_RED
      );

    _.forEach(this.cells, (cell: Cell) => {
      Apiary.wrap(() => cell.update(), cell.ref, "update");
    });

    if (Game.time % 50 === 0) this.updateDangerAnnex();

    if (
      Game.time % UPDATE_STRUCTURES_NORMAL === 0 ||
      (!this.structuresConst.length && this.sumCost) ||
      ((this.state === hiveStates.battle ||
        this.state === hiveStates.nukealert) &&
        Game.time % UPDATE_STRUCTURES_BATTLE === 0)
    )
      this.shouldRecalc = Math.max(this.shouldRecalc, 1) as 1 | 2 | 3;

    if (this.shouldRecalc) {
      Apiary.wrap(
        () => this.updateStructures(),
        "structures_" + this.roomName,
        "update"
      );
      if (this.shouldRecalc === 3) this.markResources();
      this.shouldRecalc = 0;
    }
    if (Game.time % 500 === 29 || this.state === hiveStates.nospawn)
      this.updateCellData();
  }

  public run() {
    _.forEach(this.cells, (cell: Cell) => {
      Apiary.wrap(() => cell.run(), cell.ref, "run");
    });
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.roomName}"]</a>`;
  }
}