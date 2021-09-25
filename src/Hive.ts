import { RespawnCell } from "./cells/base/respawnCell";
import { DefenseCell } from "./cells/base/defenseCell";
import { DevelopmentCell } from "./cells/stage0/developmentCell";
import { StorageCell } from "./cells/stage1/storageCell";
import { UpgradeCell } from "./cells/stage1/upgradeCell";
import { ExcavationCell } from "./cells/stage1/excavationCell";
import { LaboratoryCell } from "./cells/stage1/laboratoryCell";
import { ObserveCell } from "./cells/stage2/observeCell";
import { PowerCell } from "./cells/stage2/powerCell";

import { BuilderMaster } from "./beeMasters/economy/builder";

import { safeWrap } from "./abstract/utils";
import { hiveStates, prefix } from "./enums";
import { profile } from "./profiler/decorator";

import type { Pos } from "./abstract/roomPlanner";
import type { CreepSetup } from "./bees/creepSetups";

export interface SpawnOrder {
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // how urgent is this creep
  master?: string;
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
  excavation?: ExcavationCell,
  dev?: DevelopmentCell,
  lab?: LaboratoryCell,
  observe?: ObserveCell,
  power?: PowerCell,
}

@profile
export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  roomName: string;
  annexNames: string[] = [];

  room: Room;
  rooms: Room[] = []; //this room and annexes
  cells: HiveCells;

  spawOrders: { [id: string]: SpawnOrder } = {};

  builder?: BuilderMaster;

  pos: RoomPosition; // aka idle pos for creeps

  phase: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: 0 | 1 | 2 | 3;
  bassboost: Hive | null = null;

  structuresConst: BuildProject[] = [];
  sumCost: number = 0;

  state: hiveStates = hiveStates.economy;

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];

    if (!Memory.cache.positions[this.roomName]) {
      let pos = { x: 25, y: 25 };
      if (this.room.controller)
        pos = { x: this.room.controller!.pos.x, y: this.room.controller!.pos.y };
      Memory.cache.positions[this.roomName] = { center: pos, hive: pos, queen1: pos, queen2: pos, lab: pos }
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
      if (this.room.storage!.store.getUsedCapacity(RESOURCE_ENERGY) < 50000)
        this.cells.dev = new DevelopmentCell(this);
      this.cells.storage = new StorageCell(this, this.room.storage!);
      this.cells.upgrade = new UpgradeCell(this, this.room.controller!);
      this.cells.excavation = new ExcavationCell(this);
      this.cells.lab = new LaboratoryCell(this);

      this.builder = new BuilderMaster(this);
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
          this.cells.observe = new ObserveCell(this, obeserver);
        if (powerSpawn)
          this.cells.power = new PowerCell(this, powerSpawn)
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
        if (!Game.flags["mine_" + s.id]) {
          let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_YELLOW);
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });

    _.forEach(this.rooms, room => {
      _.forEach(room.find(FIND_MINERALS), s => {
        if (room.name !== this.roomName && !s.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_EXTRACTOR && s.isActive()).length)
          return;
        if (!Game.flags["mine_" + s.id]) {
          let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_CYAN);
          if (typeof flag === "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });
  }

  getPos(type: keyof HivePositions) {
    return new RoomPosition(Memory.cache.positions[this.roomName][type].x, Memory.cache.positions[this.roomName][type].y, this.roomName);
  }

  private updateCellData() {
    _.forEach(this.room.find(FIND_MY_STRUCTURES), structure => {
      if (this.updateCellStructure(structure, this.cells.spawn.extensions, STRUCTURE_EXTENSION) === ERR_INVALID_ARGS)
        if (this.updateCellStructure(structure, this.cells.spawn.spawns, STRUCTURE_SPAWN) === ERR_INVALID_ARGS)
          if (this.updateCellStructure(structure, this.cells.defense.towers, STRUCTURE_TOWER) === ERR_INVALID_ARGS)
            if (this.updateCellStructure(structure, this.cells.lab && this.cells.lab.laboratories, STRUCTURE_LAB) === ERR_INVALID_ARGS)
              void (0);
    });
  }

  findProject(pos: RoomPosition | { pos: RoomPosition }, ignore?: "repairs" | "constructions") {
    if (!this.structuresConst.length)
      return;

    if (!(pos instanceof RoomPosition))
      pos = pos.pos;
    let target: Structure | ConstructionSite | undefined;
    let projects = this.structuresConst;
    let getProj = () => (<RoomPosition>pos).findClosest(projects);
    if (this.state >= hiveStates.nukealert)
      getProj = () => projects.reduce((prev, curr) => curr.energyCost > prev.energyCost ? curr : prev);

    let proj = getProj();
    while (proj && !target) {
      if (ignore !== "constructions")
        target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
      if (!target && ignore !== "repairs")
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

  private updateCellStructure<S extends Structure>(structure: Structure, structureMap: { [id: string]: S } | undefined, type: StructureConstant) {
    if (structureMap)
      if (type === structure.structureType) {
        if (structure.isActive())
          structureMap[structure.id] = <S>structure;
        else
          delete structureMap[structure.id];
        return OK;
      }
    return ERR_INVALID_ARGS;
  }

  updateStructures() {
    let builderReCheck = this.sumCost > 0;
    this.structuresConst = [];
    this.sumCost = 0;
    let add = (ans: BuildProject[]) => {
      this.structuresConst = this.structuresConst.concat(ans);
      this.sumCost += _.sum(ans, pr => pr.energyCost);
    }

    switch (this.state) {
      case hiveStates.battle:
        add(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_RAMPART, STRUCTURE_WALL]));
        break;
      case hiveStates.nukealert:
        add(this.cells.defense.getNukeDefMap());
        break;
      case hiveStates.nospawn:
        add(Apiary.planner.checkBuildings(this.roomName, [STRUCTURE_SPAWN]));
        break;
      case hiveStates.economy:
        if (builderReCheck || this.shouldRecalc > 1 || Math.round(Game.time / 100) % 8 === 0)
          _.forEach(this.annexNames, annexName => {
            if (Apiary.intel.getInfo(annexName).safePlace)
              add(Apiary.planner.checkBuildings(annexName, this.phase === 0 ? [STRUCTURE_ROAD] : undefined))
          });
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
          if (!Memory.cache.roomPlanner[r.name] || !Object.keys(Memory.cache.roomPlanner[r.name]).length)
            Apiary.planner.resetPlanner(r.name);
        });
      }
      this.shouldRecalc = 0;
    }
    if (Game.time % 100 === 29)
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
