import { RespawnCell } from "./cells/base/respawnCell";
import { DefenseCell } from "./cells/base/defenseCell";
import { DevelopmentCell } from "./cells/stage0/developmentCell";
import { ExcavationCell } from "./cells/base/excavationCell";

import { StorageCell } from "./cells/stage1/storageCell";
import { UpgradeCell } from "./cells/stage1/upgradeCell";
import { LaboratoryCell } from "./cells/stage1/laboratoryCell";
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
  hive: Pos,
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

  pos: RoomPosition; // aka idle pos for creeps

  readonly phase: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: 0 | 1 | 2 | 3;
  bassboost: Hive | null = null;

  structuresConst: BuildProject[] = [];
  sumCost: number = 0;

  wallsHealth = WALL_HEALTH;
  readonly wallsHealthMax = WALL_HEALTH * 10;

  state: hiveStates = hiveStates.economy;

  resTarget: {
    "energy": number
  } & { [key in ResourceConstant]?: number } = {
      [RESOURCE_ENERGY]: Math.round(STORAGE_CAPACITY * 0.4),
      "XGH2O": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // upgrade
      "XLH2O": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // repair
      "XLHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // heal
      "XKHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // rangedAttack
      "XZHO2": LAB_BOOST_MINERAL * MAX_CREEP_SIZE * 2, // move
    }

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
      Memory.cache.hives[this.roomName] = { positions: { center: pos, hive: pos, queen1: pos, queen2: pos, lab: pos } }
    }

    this.pos = this.getPos("hive");

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
      if (this.room.storage!.store.getUsedCapacity(RESOURCE_ENERGY) < 32000)
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
    }

    //look for new structures for those wich need them
    this.updateCellData();
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

  private updateCellData() {
    _.forEach(this.room.find(FIND_MY_STRUCTURES), structure => {
      if (this.updateCellStructure(structure, this.cells.spawn.extensions, STRUCTURE_EXTENSION) === ERR_INVALID_ARGS)
        if (this.updateCellStructure(structure, this.cells.spawn.spawns, STRUCTURE_SPAWN) === ERR_INVALID_ARGS)
          if (this.updateCellStructure(structure, this.cells.defense.towers, STRUCTURE_TOWER) === ERR_INVALID_ARGS)
            if (this.updateCellStructure(structure, this.cells.lab && this.cells.lab.laboratories, STRUCTURE_LAB) === ERR_INVALID_ARGS)
              void (0);
    });

    if (this.phase > 0)
      this.cells.spawn.bakeMap();
    this.cells.defense.bakeMap();
  }

  private updateCellStructure<S extends Structure>(structure: Structure, structureMap: { [id: string]: S } | undefined, type: StructureConstant) {
    if (structureMap)
      if (type === structure.structureType) {
        if (structure.isActive())
          structureMap[structure.id] = <S>structure;
        else
          return ERR_FULL;
        return OK;
      }
    return ERR_INVALID_ARGS;
  }

  findProject(pos: RoomPosition | { pos: RoomPosition }, ignore?: "ignore_repairs" | "ignore_constructions") {
    if (!this.structuresConst.length) {
      if (this.shouldRecalc < 2)
        this.shouldRecalc = 2;
      return;
    }

    if (!(pos instanceof RoomPosition))
      pos = pos.pos;
    let target: Structure | ConstructionSite | undefined;
    let projects = this.structuresConst;
    let getProj = () => (<RoomPosition>pos).findClosest(projects);
    if (this.state >= hiveStates.nukealert)
      getProj = () => projects.reduce((prev, curr) => curr.energyCost > prev.energyCost ? curr : prev);

    let proj = getProj();
    while (proj && !target) {
      if (ignore !== "ignore_constructions")
        target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
      if (!target && ignore !== "ignore_repairs")
        target = proj.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === proj!.sType && s.hits < proj!.targetHits)[0];
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

  updateStructures() {
    let reCheck = this.sumCost > 0;
    this.structuresConst = [];
    this.sumCost = 0;
    let add = (ans: BuildProject[]) => {
      this.structuresConst = this.structuresConst.concat(ans);
      this.sumCost += _.sum(ans, pr => pr.energyCost);
    }

    switch (this.state) {
      case hiveStates.battle:
        add(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_WALL, STRUCTURE_RAMPART], {
          [STRUCTURE_WALL]: this.wallsHealth,
          [STRUCTURE_RAMPART]: this.wallsHealth,
        }, 0.99));
        if (!this.sumCost && this.wallsHealth < Math.min(this.wallsHealthMax, RAMPART_HITS_MAX[this.room.controller!.level]))
          this.wallsHealth += WALL_HEALTH;
        break;
      case hiveStates.nukealert:
        add(this.cells.defense.getNukeDefMap());
        break;
      case hiveStates.nospawn:
        add(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_SPAWN]));
        break;
      case hiveStates.economy:
        if (reCheck || this.shouldRecalc > 1 || Math.round(Game.time / 100) % 8 === 0)
          _.forEach(this.annexNames, annexName => {
            if (Apiary.intel.getInfo(annexName).safePlace)
              add(Apiary.planner.checkBuildings(annexName, this.room.energyCapacityAvailable < 800 ? [STRUCTURE_ROAD] : [STRUCTURE_ROAD, STRUCTURE_CONTAINER]))
          });

        if (this.phase === 2 && !reCheck && !this.sumCost && this.wallsHealth < this.wallsHealthMax) {
          let sCell = this.cells.storage;
          if (sCell && sCell.getUsedCapacity(RESOURCE_ENERGY) > this.resTarget[RESOURCE_ENERGY])
            this.wallsHealth += WALL_HEALTH;
          add(Apiary.planner.checkBuildings(this.roomName, undefined, {
            [STRUCTURE_WALL]: this.wallsHealth,
            [STRUCTURE_RAMPART]: this.wallsHealth,
          }));
          break;
        }

        if (!reCheck && !this.sumCost && this.builder && this.builder.activeBees) {
          add(Apiary.planner.checkBuildings(this.roomName, undefined, undefined, 0.99));
          break;
        }
      default:
        add(Apiary.planner.checkBuildings(this.roomName));
    }
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];
    if (Game.time % 40 === 5 || this.shouldRecalc || this.state >= hiveStates.nukealert) {
      this.updateAnnexes();
      this.updateStructures();
      if (this.shouldRecalc > 2) {
        this.markResources();
        _.forEach(this.rooms, r => {
          if ((!Memory.cache.roomPlanner[r.name] || !Object.keys(Memory.cache.roomPlanner[r.name]).length) && !Apiary.planner.activePlanning[r.name])
            Apiary.planner.resetPlanner(r.name, this.getPos("center"));
        });
      }
      this.shouldRecalc = 0;
    }
    if (Game.time % 100 === 29 || this.state === hiveStates.nospawn)
      this.updateCellData();
    if (Apiary.logger)
      Apiary.logger.hiveLog(this);

    // ask for boost
    if ((this.state === hiveStates.nospawn
      || (this.state === hiveStates.lowenergy && (!this.cells.storage || this.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 5000)))
      && !Apiary.orders[prefix.boost + this.roomName]) {
      let validHives = _.filter(Apiary.hives, h => h.roomName !== this.roomName && h.state === hiveStates.economy && this.pos.getRangeTo(h) < 5 && h.phase > 0)
      if (validHives.length)
        this.pos.createFlag(prefix.boost + this.roomName, COLOR_PURPLE, COLOR_WHITE);
    }


    _.forEach(this.cells, cell => {
      safeWrap(() => cell.update(), cell.print + " update");
    });
  }

  run() {
    _.forEach(this.cells, cell => {
      safeWrap(() => cell.run(), cell.print + " run");
    });
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.roomName}"]</a>`;
  }
}
