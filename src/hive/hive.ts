/**
 * Import statements
 */
import type { Cell } from "cells/_Cell";
import { DefenseCell } from "cells/base/defenseCell";
import { ExcavationCell } from "cells/base/excavationCell";
import { RespawnCell } from "cells/base/respawnCell";
import { DevelopmentCell } from "cells/stage0/developmentCell";
import { CorridorMiningCell } from "cells/stage1/corridorMining";
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
import { BASE_MODE_HIVE } from "static/constants";
import { hiveStates, prefix } from "static/enums";

import type { HiveCells, ResTarget } from "./hive-declarations";
import { addAnex, addResourceCells, updateDangerAnnex } from "./hive-mining";
import { opt, updateCellData } from "./hive-utils";

// Constant for a minimum amount of a certain mineral in the hive
const HIVE_MINERAL = 5000;

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

  /** added all resources from cache */
  public allResources = false;
  public bassboost: Hive | null = null;

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
     * 3 deep recalc with resources check
     *
     * 2 main room + annexes
     *
     * 1 main room
     *
     * 0 no need
     */
    this.shouldRecalc = Object.keys(this.cache.cells).filter((c) =>
      c.includes(prefix.resourceCells)
    ).length
      ? 2
      : 3;
    this.phase = 0;
    if (!this.controller) return;

    const activeStorage = this.room.storage && this.room.storage.isActive();
    if (activeStorage) {
      // no extra checks about sCell, so careful
      this.phase = 1;
      if (
        this.room.storage &&
        this.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <
          ENERGY_FOR_REVERTING_TO_DEV_CELLS * 1.5
      )
        this.cells.dev = new DevelopmentCell(this);
      const sCell = new StorageCell(this);
      this.cells.storage = sCell;
      this.cells.upgrade = new UpgradeCell(this);
      this.cells.lab = new LaboratoryCell(this);

      let factory: StructureFactory | undefined;
      _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
        if (s.structureType === STRUCTURE_FACTORY) factory = s;
      });
      if (factory) this.cells.factory = new FactoryCell(this, factory);
      if (this.controller.level < 8) {
        // try to develop the hive
        this.resTarget[BOOST_MINERAL.upgrade[2]] = HIVE_MINERAL;
        // to prottect
        this.resTarget[BOOST_MINERAL.attack[2]] = HIVE_MINERAL;
      } else {
        this.phase = 2;

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

        let obeserver: StructureObserver | undefined;
        let powerSpawn: StructurePowerSpawn | undefined;
        _.forEach(this.room.find(FIND_MY_STRUCTURES), (s) => {
          if (s.structureType === STRUCTURE_OBSERVER) obeserver = s;
          else if (s.structureType === STRUCTURE_POWER_SPAWN) powerSpawn = s;
        });
        if (obeserver) this.cells.observe = new ObserveCell(this, obeserver);
        if (powerSpawn) this.cells.power = new PowerCell(this, powerSpawn);
        this.cells.corridorMining = new CorridorMiningCell(this);
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

  /** Interface for settings of hive */
  public get mode() {
    return this.cache.do;
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

  public get isBattle() {
    return this.state >= hiveStates.battle;
  }

  public addAnex = addAnex;
  private updateDangerAnnex = updateDangerAnnex;

  private updateCellData = updateCellData;

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

    if (Apiary.intTime % 1500 === 1499 || this.state === hiveStates.nospawn)
      this.updateCellData();

    if (!this.allResources && Apiary.intTime % 50 === 0)
      this.allResources = addResourceCells(this);

    if (Apiary.intTime % 32 === 0) this.updateDangerAnnex();

    // ask for help
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

    _.forEach(this.cells, (cell: Cell) => {
      Apiary.wrap(() => cell.update(), cell.ref, "update");
    });
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
