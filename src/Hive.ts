import { RespawnCell } from "./cells/base/respawnCell";
import { DefenseCell } from "./cells/base/defenseCell";
import { DevelopmentCell } from "./cells/stage0/developmentCell";
import { ExcavationCell } from "./cells/base/excavationCell";

import { StorageCell } from "./cells/stage1/storageCell";
import { UpgradeCell } from "./cells/stage1/upgradeCell";
import { LaboratoryCell, BOOST_MINERAL } from "./cells/stage1/laboratoryCell";
import { FactoryCell } from "./cells/stage1/factoryCell";
import { ObserveCell } from "./cells/stage2/observeCell";
import { PowerCell } from "./cells/stage2/powerCell";

import { BuilderMaster } from "./beeMasters/economy/builder";
import { PullerMaster } from "./beeMasters/corridorMining/puller";

import { Traveler } from "./Traveler/TravelerModified";

import { makeId } from "./abstract/utils";
import { hiveStates, prefix, roomStates } from "./enums";
import { BASE_MODE_HIVE } from "./abstract/hiveMemory";

import { FULL_CAPACITY } from "./abstract/terminalNetwork";

import { profile } from "./profiler/decorator";
import type { CreepSetup } from "./bees/creepSetups";
import type { HiveCache } from "./abstract/hiveMemory";

export interface SpawnOrder {
  setup: CreepSetup,
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, // how urgent is this creep
  master: string,
  ref: string,
  createTime: number,
}

export interface BuildProject {
  pos: RoomPosition,
  sType: StructureConstant,
  targetHits: number,
  energyCost: number,
  type: "repair" | "construction",
}

export interface HiveCells {
  storage?: StorageCell,
  defense: DefenseCell,
  spawn: RespawnCell,
  upgrade?: UpgradeCell,
  excavation: ExcavationCell,
  dev?: DevelopmentCell,
  lab?: LaboratoryCell,
  factory?: FactoryCell,
  observe?: ObserveCell,
  power?: PowerCell,
}

export type ResTarget = { [key in ResourceConstant]?: number };

const HIVE_MINERAL = LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2;
export const HIVE_ENERGY = Math.round(STORAGE_CAPACITY * 0.4);
type StructureGroups = "essential" | "roads" | "mining" | "defense" | "hightech" | "trade";

const BUILDABLE_PRIORITY: { [key in StructureGroups]: BuildableStructureConstant[] } = {
  essential: [
    STRUCTURE_TOWER,
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
  ],
  roads: [
    STRUCTURE_ROAD,
  ],
  mining: [
    STRUCTURE_LINK,
    STRUCTURE_CONTAINER,
    STRUCTURE_EXTRACTOR,
  ],
  trade: [
    STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL,
  ],
  defense: [
    STRUCTURE_WALL,
    STRUCTURE_RAMPART,
  ],
  hightech: [
    STRUCTURE_LAB,
    STRUCTURE_OBSERVER,
    STRUCTURE_POWER_SPAWN,
    STRUCTURE_FACTORY,
    STRUCTURE_NUKER,
  ],
};

@profile
export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  readonly roomName: string;
  annexNames: string[] = [];
  annexInDanger: string[] = [];

  room: Room;
  rooms: Room[] = []; //this room and annexes
  readonly cells: HiveCells;

  spawOrders: { [id: string]: SpawnOrder } = {};

  readonly builder?: BuilderMaster;
  readonly puller?: PullerMaster;

  readonly phase: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: 0 | 1 | 2 | 3;
  bassboost: Hive | null = null;

  structuresConst: BuildProject[] = [];
  sumCost: number = 0;

  readonly wallsHealthMax = Memory.settings.wallsHealth;

  state: hiveStates = hiveStates.economy;

  resTarget: { "energy": number } & ResTarget = {
    // energy
    [RESOURCE_ENERGY]: HIVE_ENERGY,
    [BOOST_MINERAL.build[2]]: HIVE_MINERAL * 2,
    // cheap but good
    // [BOOST_MINERAL.fatigue[0]]: HIVE_MINERAL / 2,
    // [BOOST_MINERAL.build[0]]: HIVE_MINERAL,
    // [BOOST_MINERAL.attack[0]]: HIVE_MINERAL,
    // [BOOST_MINERAL.damage[1]]: HIVE_MINERAL,
    // [BOOST_MINERAL.attack[1]]: HIVE_MINERAL,
  }
  resState: { "energy": number } & ResTarget = { energy: 0 };
  mastersResTarget: ResTarget = {}
  shortages: ResTarget = {};

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];

    if (!this.cache)
      Memory.cache.hives[this.roomName] = { wallsHealth: Math.max(Memory.settings.wallsHealth * 0.0025, 10000), cells: {}, do: { ...BASE_MODE_HIVE } };

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new RespawnCell(this),
      defense: new DefenseCell(this),
      excavation: new ExcavationCell(this),
    };

    this.shouldRecalc = 3;
    this.phase = 0;
    if (!this.controller)
      return;

    let storage = this.room.storage || this.room.terminal;
    if (storage && storage.isActive()) {
      this.phase = 1;
      if (this.room.storage && this.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 6000)
        this.cells.dev = new DevelopmentCell(this);
      let sCell = new StorageCell(this, storage);
      this.cells.storage = sCell;
      this.cells.upgrade = new UpgradeCell(this, this.controller, sCell);
      this.cells.lab = new LaboratoryCell(this, sCell);

      this.builder = new BuilderMaster(this, sCell);
      let factory: StructureFactory | undefined;
      _.forEach(this.room.find(FIND_MY_STRUCTURES), s => {
        if (s.structureType === STRUCTURE_FACTORY)
          factory = s;
      });
      if (factory)
        this.cells.factory = new FactoryCell(this, factory, sCell);
      this.wallsHealth = Math.max(Memory.settings.wallsHealth * 0.0005, this.wallsHealth);
      if (this.controller.level < 8) {
        // try to develop the hive
        this.resTarget[BOOST_MINERAL.upgrade[2]] = HIVE_MINERAL;
        this.wallsHealthMax = Math.min(Memory.settings.wallsHealth * 0.1, 2000000);
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

        // attack stuff
        // this.resTarget[BOOST_MINERAL.dismantle[2]] = HIVE_MINERAL;

        // save energy for a bad day
        this.resTarget[RESOURCE_BATTERY] = 5000;

        let obeserver: StructureObserver | undefined;
        let powerSpawn: StructurePowerSpawn | undefined;
        _.forEach(this.room.find(FIND_MY_STRUCTURES), s => {
          if (s.structureType === STRUCTURE_OBSERVER)
            obeserver = s;
          else if (s.structureType == STRUCTURE_POWER_SPAWN)
            powerSpawn = s;
        });
        if (obeserver)
          this.cells.observe = new ObserveCell(this, obeserver, sCell);
        if (powerSpawn)
          this.cells.power = new PowerCell(this, powerSpawn, sCell);
        // TODO cause i haven' reached yet
      }
    } else {
      this.wallsHealth = Memory.settings.wallsHealth * 0.0005, this.wallsHealth;
      this.wallsHealthMax = this.wallsHealth * 10;
      this.cells.dev = new DevelopmentCell(this);
    }

    if (this.wallsHealth > this.wallsHealthMax)
      this.wallsHealthMax = this.wallsHealth;

    this.updateCellData(true);
    if (!this.cells.dev && !Object.keys(this.cells.spawn.spawns).length)
      this.cells.dev = new DevelopmentCell(this);

    if (Apiary.logger)
      Apiary.logger.initHive(this.roomName);
  }

  shouldDo(action: keyof HiveCache["do"]) {
    return this.cache.do[action];
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName))
      this.annexNames.push(annexName);
    if (this.cells.dev)
      this.cells.dev.shouldRecalc = true;
    if (this.shouldRecalc < 3)
      this.shouldRecalc = 3;
  }

  stateChange(state: keyof typeof hiveStates, trigger: boolean) {
    let st = hiveStates[state];
    if (trigger) {
      if (st > this.state)
        this.state = st;
    } else if (this.state === st)
      this.state = hiveStates.economy;
  }

  updateAnnexes(): void {
    let annexes = <Room[]>_.compact(_.map(this.annexNames, annexName => {
      let annex = Game.rooms[annexName];
      return annex;
    }));
    this.rooms = [this.room].concat(annexes);
  }

  // actually needs to be done only once, but well couple times each reboot is not worst scenario
  markResources() {
    _.forEach(this.rooms, room => {
      _.forEach(room.find(FIND_SOURCES), s => {
        if (!s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_YELLOW && (f.secondaryColor === COLOR_YELLOW || f.secondaryColor === COLOR_RED)).length) {
          let flag = s.pos.createFlag(prefix.mine + makeId(2) + "_" + s.id.slice(s.id.length - 4), COLOR_YELLOW, COLOR_YELLOW);
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });

    _.forEach(this.rooms, room => {
      _.forEach(room.find(FIND_MINERALS), s => {
        if (room.name !== this.roomName && !s.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_EXTRACTOR && s.isActive()).length)
          return;
        if (!s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_YELLOW && (f.secondaryColor === COLOR_CYAN || f.secondaryColor === COLOR_RED)).length) {
          let flag = s.pos.createFlag(prefix.mine + makeId(2) + "_" + s.id.slice(s.id.length - 4), COLOR_YELLOW, COLOR_CYAN);
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });
  }

  get pos() {
    return this.cells.defense.pos;
  }

  get rest() {
    return this.cells.excavation.pos;
  }

  get controller() {
    return this.room.controller!;
  }

  private updateCellData(bake = false) {
    _.forEach(this.room.find(FIND_MY_STRUCTURES), s => {
      switch (s.structureType) {
        case STRUCTURE_EXTENSION:
          this.cells.spawn.extensions[s.id] = s;
          break;
        case STRUCTURE_SPAWN:
          this.cells.spawn.spawns[s.id] = s;
          break;
        case STRUCTURE_TOWER:
          this.cells.defense.towers[s.id] = s;
          break;
        case STRUCTURE_LAB:
          if (!this.cells.lab)
            return;
          this.cells.lab.laboratories[s.id] = s;
          break;
        case STRUCTURE_STORAGE:
          if (!this.cells.storage && Apiary.useBucket)
            Apiary.destroyTime = Game.time;
          break;
        case STRUCTURE_FACTORY:
          if (!this.cells.factory && this.cells.storage)
            this.cells.factory = new FactoryCell(this, s, this.cells.storage);
          break;
        case STRUCTURE_POWER_SPAWN:
          if (!this.cells.power && this.cells.storage)
            this.cells.power = new PowerCell(this, s, this.cells.storage);
          break;
        case STRUCTURE_OBSERVER:
          if (!this.cells.observe && this.cells.storage)
            this.cells.observe = new ObserveCell(this, s, this.cells.storage);
          break;
        case STRUCTURE_TERMINAL:
          if (!this.cells.storage) {
            if (Apiary.useBucket)
              Apiary.destroyTime = Game.time;
          } else
            this.cells.storage.terminal = s;
          break;
      }
    });

    if (this.phase > 0 && bake) {
      this.cells.spawn.bakePriority();
      if (this.cells.lab)
        this.cells.lab.bakeMap();
    }
  }

  getBuildTarget(pos: RoomPosition | { pos: RoomPosition }, ignore?: "ignoreRepair" | "ignoreConst") {
    if (!this.structuresConst.length) {
      if (this.shouldRecalc < 2 && (this.wallsHealth < this.wallsHealthMax || this.state >= hiveStates.nukealert))
        this.shouldRecalc = 2;
      return;
    }

    if (!(pos instanceof RoomPosition))
      pos = pos.pos;
    let target: Structure | ConstructionSite | undefined;
    let projects: BuildProject[];

    if (ignore)
      projects = [...this.structuresConst];
    else
      projects = this.structuresConst;

    let getProj = () => projects.length && (<RoomPosition>pos).findClosest(projects);

    let wax = Game.flags[prefix.build + this.roomName];
    if (wax && this.state !== hiveStates.battle) {
      let proj = projects.filter(p => wax.pos.getRangeTo(p) <= 2);
      if (proj.length)
        projects = proj;
    }

    if (this.state >= hiveStates.battle) {
      let inDanger = projects.filter(p => p.pos.findInRange(FIND_HOSTILE_CREEPS, 3));
      ignore = "ignoreConst";
      if (inDanger.length)
        projects = inDanger;
      else
        projects = [...projects];

      let enemy = Apiary.intel.getEnemyCreep(this);
      if (enemy)
        pos = enemy.pos; // dont work well with several points
      getProj = () => projects.length && projects.reduce((prev, curr) => {
        let ans = curr.pos.getRangeTo(pos) - prev.pos.getRangeTo(pos);
        if (ans === 0)
          ans = prev.energyCost - curr.energyCost;
        return ans < 0 ? curr : prev;
      });
    }

    let proj = getProj();
    while (proj && !target) {
      if (proj.pos.roomName in Game.rooms)
        switch (proj.type) {
          case "construction":
            if (ignore !== "ignoreConst")
              target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
            break;
          case "repair":
            if (ignore !== "ignoreRepair")
              target = proj.pos.lookFor(LOOK_STRUCTURES).filter(s =>
                s.structureType === (<BuildProject>proj).sType
                && s.hits < (<BuildProject>proj).targetHits
                && s.hits < s.hitsMax)[0];
            break;
        }
      if (target && target.pos.roomName !== this.roomName && this.annexInDanger.includes(target.pos.roomName))
        target = undefined;
      if (!target) {
        for (let k = 0; k < projects.length; ++k)
          if (projects[k].pos.x == proj.pos.x && projects[k].pos.y == proj.pos.y) {
            projects.splice(k, 1);
            break;
          }
        proj = getProj();
      }
    }

    return target;
  }

  get cache() {
    return Memory.cache.hives[this.roomName];
  }

  get wallsHealth() {
    return this.cache.wallsHealth;
  }

  set wallsHealth(value) {
    this.cache.wallsHealth = value;
  }

  get opt() {
    let opt: TravelToOptions = { useFindRoute: true };
    if (this.state >= hiveStates.battle) {
      opt.stuckValue = 1;
      let terrain = Game.map.getRoomTerrain(this.roomName);
      opt.roomCallback = (roomName, matrix) => {
        if (roomName !== this.roomName)
          return
        let enemies = Apiary.intel.getInfo(roomName, 10).enemies.map(e => e.object);
        _.forEach(enemies, c => {
          let fleeDist = 0;
          if (c instanceof Creep)
            fleeDist = Apiary.intel.getFleeDist(c);
          if (!fleeDist)
            return;
          _.forEach(c.pos.getPositionsInRange(fleeDist), p => {
            if (p.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART && (<StructureRampart>s).my && s.hits > 10000).length)
              return;
            let value = p.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length ? 0x20
              : (terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 0x40 : 0x30);
            if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL)
              value = 0xff; // idk why but sometimes the matrix is not with all walls...
            if (matrix.get(p.x, p.y) < value)
              matrix.set(p.x, p.y, value);
          });
          matrix.set(c.pos.x, c.pos.y, 0xff);
        });
        return matrix;
      }
    }
    return opt;
  }

  get wallMap() {
    return {
      [STRUCTURE_WALL]: this.wallsHealth,
      [STRUCTURE_RAMPART]: this.wallsHealth,
    };
  }

  updateStructures() {
    let reCheck = this.sumCost > 0;
    let nukeAlert = !!Object.keys(this.cells.defense.nukes).length;
    this.structuresConst = [];
    this.sumCost = 0;
    let addCC = (ans: [BuildProject[], number]) => {
      this.structuresConst = this.structuresConst.concat(ans[0]);
      this.sumCost += ans[1];
    }
    let checkAnnex = () => {
      _.forEach(this.annexNames, annexName => {
        if (!(annexName in Game.rooms) || this.annexInDanger.includes(annexName))
          return;
        let roomInfo = Apiary.intel.getInfo(annexName, Infinity);
        if (this.room.energyCapacityAvailable < 5500 && (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral))
          return;
        let annexRoads = Apiary.planner.checkBuildings(annexName, BUILDABLE_PRIORITY.roads, false)
        addCC(annexRoads);
        if (this.room.energyCapacityAvailable >= 650) { // 800
          let annexMining = Apiary.planner.checkBuildings(annexName, BUILDABLE_PRIORITY.mining, false);
          addCC(annexMining);
          if (roomInfo.roomState === roomStates.SKfrontier && this.resState[RESOURCE_ENERGY] >= 0) {
            let mineralsContainer = annexMining[0].filter(b => b.sType === STRUCTURE_CONTAINER && b.type === "construction" && b.pos.findInRange(FIND_MINERALS, 1).length)[0];
            // if (!mineralsContainer) mineralsContainer = annexMining[0].filter(b => b.sType === STRUCTURE_CONTAINER && b.type === "construction")[0];
            if (mineralsContainer && roomInfo.safePlace && !annexRoads[0].filter(b => b.type === "construction").length
              && !Game.flags["containerBuilder_" + this.roomName]) // one per hive at a time
              mineralsContainer.pos.createFlag("containerBuilder_" + this.roomName, COLOR_BLUE, COLOR_YELLOW);
          }
          /* let annexHive = Apiary.hives[annexName]; old code when i needed to swarm build hives
          if (annexHive)
            addCC([annexHive.structuresConst, annexHive.sumCost]); */
        }
      });
    }

    if ((!reCheck && this.shouldRecalc <= 1 && Math.round(Game.time / 100) % 8 !== 0) || this.controller.level < 2)
      checkAnnex = () => { };

    switch (this.state) {
      case hiveStates.nukealert:
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining, false));
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, false, this.wallMap, 0.55));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.roads, false));
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.trade, true));
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.hightech, true));
        if (!this.structuresConst.length)
          addCC(this.cells.defense.getNukeDefMap(true));
        else {
          this.sumCost += this.cells.defense.getNukeDefMap(true)[1] +
            Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, true, this.wallMap, 0.99)[1];
        }
        // checkAnnex();
        break;
      case hiveStates.nospawn:
        addCC(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_SPAWN], nukeAlert));
        break;
      case hiveStates.lowenergy:
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.roads, false));
        checkAnnex();
        break;
      case hiveStates.battle:
        let roomInfo = Apiary.intel.getInfo(this.roomName);
        if (roomInfo.enemies.length) {
          let proj = Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, false, {
            [STRUCTURE_WALL]: this.wallsHealth * 1.5,
            [STRUCTURE_RAMPART]: this.wallsHealth * 1.5,
          }, 0.99);
          addCC([proj[0].filter(p => roomInfo.enemies.filter(e => p.pos.getRangeTo(e.object) <= 5).length), proj[1]]);
        }
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert, this.wallMap, 0.99));
        break;
      case hiveStates.economy:
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining, false));
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.trade, nukeAlert));
        if (!this.structuresConst.length)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert, this.wallMap, this.wallsHealth > 1000000 ? 0.9 : undefined));
        else {
          let defenses = Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, false);
          if (defenses[0].length && this.controller.level >= 6)
            this.structuresConst = [];
          addCC(defenses);
        }
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.roads, nukeAlert));
        if (!this.structuresConst.length && this.cells.storage && this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) >= this.resTarget[RESOURCE_ENERGY] / 2)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.hightech, nukeAlert));
        checkAnnex();
        if (!this.structuresConst.length && this.builder && this.builder.activeBees)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert, this.wallMap, 0.99));
        if (!this.structuresConst.length
          && this.wallsHealth < this.wallsHealthMax
          && ((this.cells.storage && this.resState[RESOURCE_ENERGY] > 0)
            || (this.wallsHealth < this.wallsHealthMax && this.controller.level >= 4))) {
          this.wallsHealth = Math.min(this.wallsHealth + 4 * Memory.settings.wallsHealth * 0.0005, this.wallsHealthMax);
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert, this.wallMap, 0.99));
        }
        break;
      default:
        // never for now
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, nukeAlert, this.wallMap));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.roads, false));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.hightech, nukeAlert));
    }
  }

  updateDangerAnnex() {
    this.annexInDanger = [];
    _.forEach(this.annexNames, annexName => {
      let path = Traveler.findRoute(this.roomName, annexName);
      if (path)
        for (let roomName in path) {
          if (roomName === this.roomName)
            continue;
          if (!Apiary.intel.getInfo(roomName, 25).safePlace && (!Apiary.hives[roomName] || Apiary.hives[roomName].cells.defense.isBreached)) {
            this.annexInDanger.push(annexName);
            return;
          }
        }
    });
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];

    this.mastersResTarget = {};

    // ask for boost
    if ((this.state === hiveStates.nospawn
      || (this.state === hiveStates.lowenergy && (!this.cells.storage || this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) < 5000)))
      && !Apiary.orders[prefix.boost + this.roomName]) {
      let validHives = _.filter(Apiary.hives, h => h.roomName !== this.roomName && h.state === hiveStates.economy && this.pos.getRoomRangeTo(h) <= 13 && h.phase > 0);
      if (validHives.length)
        this.pos.createFlag(prefix.boost + this.roomName, COLOR_PURPLE, COLOR_WHITE);
    }

    // check if hive storage is full
    if (this.cells.storage && this.cells.storage.storage.store.getFreeCapacity() <= FULL_CAPACITY * 0.5 && !Apiary.orders[prefix.clear + this.roomName])
      this.pos.createFlag(prefix.clear + this.roomName, COLOR_ORANGE, COLOR_RED);

    _.forEach(this.cells, cell => {
      Apiary.wrap(() => cell.update(), cell.ref, "update");
    });

    let updateStructures = Game.time % 150 === 5
      || this.shouldRecalc
      || (this.state >= hiveStates.battle && Game.time % 25 === 5)
      || (!this.structuresConst.length && this.sumCost);

    if (Game.time % 50 === 0)
      this.updateDangerAnnex();

    if (updateStructures) {
      this.updateAnnexes();
      Apiary.wrap(() => this.updateStructures(), "structures " + this.room, "update");
      if (this.shouldRecalc > 2)
        this.markResources();
      this.shouldRecalc = 0;
    }
    if (Game.time % 500 === 29 || this.state === hiveStates.nospawn)
      this.updateCellData();
  }

  run() {
    _.forEach(this.cells, cell => {
      Apiary.wrap(() => cell.run(), cell.ref, "run");
    });
  }

  public add(dict: ResTarget, res: string, amount: number) {
    if (!dict[<ResourceConstant>res])
      dict[<ResourceConstant>res] = 0;
    dict[<ResourceConstant>res]! += amount;
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.roomName}"]</a>`;
  }
}
