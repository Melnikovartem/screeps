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

import { safeWrap, makeId } from "./abstract/utils";
import { hiveStates, prefix } from "./enums";
import { WALL_HEALTH } from "abstract/roomPlanner";

import { profile } from "./profiler/decorator";
import type { CreepSetup } from "./bees/creepSetups";

export interface SpawnOrder {
  setup: CreepSetup,
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, // how urgent is this creep
  master: string,
  ref: string,
}

export interface HivePositions {
  rest: Pos,
  queen1: Pos,
  queen2: Pos,
  lab: Pos,
  center: Pos,
}

export interface BuildProject {
  pos: RoomPosition,
  sType: StructureConstant,
  targetHits: number,
  energyCost: number,
  type: "repair" | "construction",
}

export type PossiblePositions = { [id in keyof HivePositions]?: Pos };

interface HiveCells {
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
type StructureGroups = "essential" | "mining" | "defense" | "hightech" | "trade";
const BUILDABLE_PRIORITY: { [key in StructureGroups]: BuildableStructureConstant[] } = {
  essential: [
    STRUCTURE_TOWER,
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
  ],
  mining: [
    STRUCTURE_ROAD,
    STRUCTURE_CONTAINER,
    STRUCTURE_LINK,
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

  room: Room;
  rooms: Room[] = []; //this room and annexes
  readonly cells: HiveCells;

  spawOrders: { [id: string]: SpawnOrder } = {};

  readonly builder?: BuilderMaster;

  readonly phase: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: 0 | 1 | 2 | 3;
  bassboost: Hive | null = null;

  structuresConst: BuildProject[] = [];
  sumCost: number = 0;

  readonly wallsHealthMax = WALL_HEALTH * 200;

  state: hiveStates = hiveStates.economy;

  resTarget: { "energy": number } & ResTarget = {
    // energy
    [RESOURCE_ENERGY]: Math.round(STORAGE_CAPACITY * 0.4),

    // cheap but good
    [BOOST_MINERAL.fatigue[0]]: HIVE_MINERAL * 2,
    [BOOST_MINERAL.build[0]]: HIVE_MINERAL,
    [BOOST_MINERAL.damage[1]]: HIVE_MINERAL,
    [BOOST_MINERAL.attack[0]]: HIVE_MINERAL,
    [BOOST_MINERAL.attack[1]]: HIVE_MINERAL * 2,
  }
  resState: { "energy": number } & ResTarget = { energy: 0 };
  mastersResTarget: ResTarget = {}
  shortages: ResTarget = {};

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];

    if (!Memory.cache.hives[this.roomName]) {
      let pos = { x: 25, y: 25 };
      if (this.room.controller)
        pos = { x: this.room.controller!.pos.x, y: this.room.controller!.pos.y };
      let spawn = this.room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_SPAWN)[0];
      if (spawn)
        pos = spawn.pos;
      Memory.cache.hives[this.roomName] = { positions: { center: pos, rest: pos, queen1: pos, queen2: pos, lab: pos }, wallsHealth: WALL_HEALTH * 10 }
    }

    this.phase = 0;
    if (this.room.storage && this.room.storage.isActive())
      this.phase = 1;

    if (this.phase === 1 && this.room.controller!.level === 8)
      this.phase = 2;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      spawn: new RespawnCell(this),
      defense: new DefenseCell(this),
      excavation: new ExcavationCell(this),
    };

    if (this.phase === 0) {
      this.wallsHealth = WALL_HEALTH;
      this.wallsHealthMax = WALL_HEALTH;
      this.cells.dev = new DevelopmentCell(this);
      if (Memory.cache.roomPlanner[roomName] && Memory.cache.roomPlanner[roomName].road)
        _.forEach(Memory.cache.roomPlanner[roomName].road!.pos, r => {
          let pos = new RoomPosition(r.x, r.y, roomName);
          if (pos.getRangeTo(this.getPos("center")) <= 6)
            return;
          let structures = pos.lookFor(LOOK_STRUCTURES);
          if (structures.filter(s => s.structureType === STRUCTURE_ROAD).length)
            return;
          if (structures.length)
            structures[0].destroy();
          if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
            return;
          pos.createConstructionSite(STRUCTURE_ROAD);
        });
    } else {
      if (this.room.storage!.store.getUsedCapacity(RESOURCE_ENERGY) < 10000)
        this.cells.dev = new DevelopmentCell(this);
      let sCell = new StorageCell(this, this.room.storage!);
      this.cells.storage = sCell;
      this.cells.upgrade = new UpgradeCell(this, this.room.controller!, sCell);
      this.cells.lab = new LaboratoryCell(this, sCell);

      this.builder = new BuilderMaster(this, sCell);
      let factory: StructureFactory | undefined;
      _.forEach(this.room.find(FIND_MY_STRUCTURES), s => {
        if (s.structureType === STRUCTURE_FACTORY)
          factory = s;
      });
      if (factory)
        this.cells.factory = new FactoryCell(this, factory, sCell);
      if (this.phase === 2) {
        // hihgh lvl minerals to protect my hive
        this.resTarget[BOOST_MINERAL.heal[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.rangedAttack[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.fatigue[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.attack[2]] = HIVE_MINERAL;
        this.resTarget[BOOST_MINERAL.build[2]] = HIVE_MINERAL;

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
        this.wallsHealthMax = this.wallsHealthMax * 10; // RAMPART_HITS_MAX[8]
        // TODO cause i haven' reached yet
      } else {
        // try to develop the hive
        this.resTarget[BOOST_MINERAL.upgrade[0]] = HIVE_MINERAL * 2;
        this.resTarget[BOOST_MINERAL.upgrade[2]] = HIVE_MINERAL;
      }
    }

    //look for new structures for those wich need them
    this.updateCellData();
    if (!this.cells.dev && !Object.keys(this.cells.spawn.spawns).length)
      this.cells.dev = new DevelopmentCell(this);

    this.shouldRecalc = 3;
    if (Apiary.logger)
      Apiary.logger.initHive(this.roomName);
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName))
      this.annexNames.push(annexName);
    if (annexName in Game.rooms) {
      if (this.cells.dev)
        this.cells.dev.addRoom(Game.rooms[annexName]);
      if (this.shouldRecalc < 3)
        this.shouldRecalc = 3;
      return OK;
    } else
      return ERR_NOT_FOUND;
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
        if (!s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_YELLOW && f.secondaryColor === COLOR_YELLOW).length) {
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
        if (!s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_YELLOW && f.secondaryColor === COLOR_CYAN).length) {
          let flag = s.pos.createFlag(prefix.mine + makeId(2) + "_" + s.id.slice(s.id.length - 4), COLOR_YELLOW, COLOR_CYAN);
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });
  }

  getPos(type: keyof HivePositions) {
    let pos = Memory.cache.hives[this.roomName].positions[type];
    return new RoomPosition(pos.x, pos.y, this.roomName);
  }

  get pos() {
    return this.getPos("center");
  }

  get rest() {
    return this.getPos("rest");
  }

  private updateCellData() {
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
          if (!this.cells.lab) {
            Apiary.destroyTime = Game.time;
            return;
          }
          this.cells.lab.laboratories[s.id] = s;
          break;
      }
    });

    if (this.phase > 0)
      this.cells.spawn.bakeMap();
    this.cells.defense.bakeMap();
  }

  getBuildTarget(pos: RoomPosition | { pos: RoomPosition }, ignore?: "ignoreRepair" | "ignoreConst") {
    if (!this.structuresConst.length) {
      if (this.shouldRecalc < 2)
        this.shouldRecalc = 2;
      return;
    }


    /*
    // my enemy had problems with walls so i build a lot of them but small ones
    let emegencyBuilds = this.room.find(FIND_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_WHITE);
    if (emegencyBuilds.length) {
      let proj = _.compact(emegencyBuilds.map(f => f.pos.findInRange(FIND_CONSTRUCTION_SITES, 3)[0]));
      if (proj.length)
        return this.pos.findClosest(proj);
    }
    */


    if (!(pos instanceof RoomPosition))
      pos = pos.pos;
    let target: Structure | ConstructionSite | undefined;
    let projects = this.structuresConst;
    let getProj = () => projects.length && (<RoomPosition>pos).findClosest(projects);

    if (this.state === hiveStates.battle) {
      let inDanger = projects.filter(p => p.pos.findInRange(FIND_HOSTILE_CREEPS, 3));
      ignore = "ignoreConst";
      if (inDanger.length)
        projects = inDanger;
      let enemy = Apiary.intel.getEnemyCreep(this);
      if (enemy)
        pos = enemy.pos; // dont work well with several points
      getProj = () => projects.length && projects.reduce((prev, curr) => {
        let ans = curr.pos.getRangeTo(pos) - prev.pos.getRangeTo(pos);
        if (ans === 0)
          ans = prev.energyCost - curr.energyCost;
        return ans < 0 ? curr : prev;
      });
    } else if (this.state === hiveStates.nukealert)
      getProj = () => projects.length && projects.reduce((prev, curr) => curr.energyCost > prev.energyCost ? curr : prev);

    let proj = getProj();
    while (proj && !target) {
      switch (proj.type) {
        case "construction":
          if (ignore !== "ignoreConst")
            target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
          break;
        case "repair":
          if (ignore !== "ignoreRepair")
            target = proj.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === (<BuildProject>proj).sType && s.hits < (<BuildProject>proj).targetHits)[0];
      }
      if (!target) {
        for (let k = 0; k < projects.length; ++k)
          if (projects[k].pos.x == proj.pos.x && projects[k].pos.y == proj.pos.y) {
            projects.splice(k, 1);
            break;
          }
        proj = getProj();
      }
    }

    if (!ignore)
      this.structuresConst = projects;

    return target;
  }

  get wallsHealth() {
    return Memory.cache.hives[this.roomName].wallsHealth;
  }

  set wallsHealth(value) {
    Memory.cache.hives[this.roomName].wallsHealth = value;
  }

  get wallMap() {
    return {
      [STRUCTURE_WALL]: this.wallsHealth,
      [STRUCTURE_RAMPART]: this.wallsHealth,
    };
  }

  updateStructures() {
    let reCheck = this.sumCost > 0;
    this.structuresConst = [];
    this.sumCost = 0;
    let addCC = (ans: BuildProject[]) => {
      this.structuresConst = this.structuresConst.concat(ans);
      this.sumCost += _.sum(ans, pr => pr.energyCost);
    }
    let checkAnnex = () => {
      if (reCheck || this.shouldRecalc > 1 || Math.round(Game.time / 100) % 8 === 0)
        _.forEach(this.annexNames, annexName => {
          if (Apiary.intel.getInfo(annexName).safePlace)
            addCC(Apiary.planner.checkBuildings(annexName, this.room.energyCapacityAvailable < 800 ? [STRUCTURE_ROAD] : BUILDABLE_PRIORITY.mining));
        });
    }

    switch (this.state) {
      case hiveStates.battle:
        let health = this.wallsHealth;
        while (!this.sumCost && health < Math.min(this.wallsHealthMax + WALL_HEALTH * 5, RAMPART_HITS_MAX[this.room.controller!.level])) {
          health += WALL_HEALTH * 5;
          let proj = Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, {
            [STRUCTURE_WALL]: health,
            [STRUCTURE_RAMPART]: health,
          }, 0.9);
          addCC(proj.filter(p => p.pos.findInRange(FIND_HOSTILE_CREEPS, 6).length));
        }
        break;
      case hiveStates.nukealert:
        addCC(this.cells.defense.getNukeDefMap());
        break;
      case hiveStates.nospawn:
        addCC(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_SPAWN]));
        break;
      case hiveStates.lowenergy:
        checkAnnex();
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, this.wallMap));
        break;
      case hiveStates.economy:
        checkAnnex();
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining));
        if (!this.sumCost)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.trade));
        if (!this.sumCost)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense));
        if (!this.sumCost)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.hightech));

        if (!this.sumCost && this.builder && this.builder.activeBees)
          addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, this.wallMap, 0.99));
        if (!this.sumCost && this.cells.storage && this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) > this.resTarget[RESOURCE_ENERGY] / 2)
          this.wallsHealth += WALL_HEALTH;
        break;
      default:
        // never for now
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.essential));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.mining));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.defense, this.wallMap));
        addCC(Apiary.planner.checkBuildings(this.roomName, BUILDABLE_PRIORITY.hightech));
    }
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];

    this.mastersResTarget = {};

    // ask for boost
    if ((this.state === hiveStates.nospawn
      || (this.state === hiveStates.lowenergy && (!this.cells.storage || this.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 5000)))
      && !Apiary.orders[prefix.boost + this.roomName]) {
      let validHives = _.filter(Apiary.hives, h => h.roomName !== this.roomName && h.state === hiveStates.economy && this.pos.getRoomRangeTo(h) < 5 && h.phase > 0)
      if (validHives.length)
        this.pos.createFlag(prefix.boost + this.roomName, COLOR_PURPLE, COLOR_WHITE);
    }


    _.forEach(this.cells, cell => {
      safeWrap(() => cell.update(), cell.print + " update");
    });

    if (Game.time % 40 === 5 || this.shouldRecalc || this.state >= hiveStates.nukealert) {
      this.updateAnnexes();
      this.updateStructures();
      if (this.shouldRecalc > 2)
        this.markResources();
      this.shouldRecalc = 0;
    }
    if (Game.time % 100 === 29 || this.state === hiveStates.nospawn)
      this.updateCellData();
    if (Apiary.logger)
      Apiary.logger.hiveLog(this);
  }

  run() {
    _.forEach(this.cells, cell => {
      safeWrap(() => cell.run(), cell.print + " run");
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
