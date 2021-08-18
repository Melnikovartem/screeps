import { Cell } from "./cells/_Cell";
import { respawnCell } from "./cells/base/respawnCell";
import { defenseCell } from "./cells/base/defenseCell";

import { developmentCell } from "./cells/stage0/developmentCell";

import { storageCell } from "./cells/stage1/storageCell";
import { upgradeCell } from "./cells/stage1/upgradeCell";
import { excavationCell } from "./cells/stage1/excavationCell";
import { laboratoryCell } from "./cells/stage1/laboratoryCell";

import { builderMaster } from "./beeMaster/economy/builder";

import { safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { UPDATE_EACH_TICK, LOGGING_CYCLE } from "./settings";

import { CreepSetup } from "./creepSetups";

export interface SpawnOrder {
  amount: number;
  setup: CreepSetup;
  priority: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // how urgent is this creep
  master?: string;
}

interface hiveCells {
  storage?: storageCell;
  defense: defenseCell;
  spawn: respawnCell;
  upgrade?: upgradeCell;
  excavation?: excavationCell;
  dev?: developmentCell;
  lab?: laboratoryCell;
}

@profile
class repairSheet {
  [STRUCTURE_RAMPART]: number = 200000;
  [STRUCTURE_WALL]: number = 200000;
  other: number = 1;
  collapse: number = 0.75;
  road_collapse: number = 0.5;

  constructor(hiveStage: 0 | 1 | 2) {
    if (hiveStage == 0) {
      this[STRUCTURE_RAMPART] = 20000;
      this[STRUCTURE_WALL] = 20000;
      this.other = 0.7;
      this.collapse = 0.5;
    } else if (hiveStage == 2) {
      this[STRUCTURE_RAMPART] = 2000000;
      this[STRUCTURE_WALL] = 2000000;
      this.other = 1;
      this.collapse = 0.86;
      this.road_collapse = 0.25;
    }
  }

  isAnEmergency(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType] * this.collapse;
      }
      case STRUCTURE_ROAD: {
        return structure.hits < structure.hitsMax * this.other * this.road_collapse;
      }
      default: {
        return structure.hits < structure.hitsMax * this.other * this.collapse;
      }
    }
  }

  isAnRepairCase(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType];
      }
      default: {
        return structure.hits < structure.hitsMax * this.other;
      }
    }
  }
}

@profile
export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  roomName: string;
  annexNames: string[] = [];

  room: Room;
  annexes: Room[] = []; // this room and annexes
  rooms: Room[] = []; //this room and annexes
  cells: hiveCells;
  repairSheet: repairSheet;

  spawOrders: { [id: string]: SpawnOrder } = {};

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];

  builder?: builderMaster;

  pos: RoomPosition; // aka idle pos for creeps

  stage: 0 | 1 | 2;
  // 0 up to storage tech
  // 1 storage - 7lvl
  // max

  shouldRecalc: boolean;
  bassboost: Hive | null = null;

  // help grow creeps from other colony

  constructor(roomName: string) {
    this.roomName = roomName;
    this.room = Game.rooms[roomName];
    this.pos = this.room.controller!.pos;

    this.stage = 0;
    if (this.room.storage && this.room.storage.store[RESOURCE_ENERGY] > 1000)
      this.stage = 1;

    if (this.stage == 1 && this.room.controller!.level == 8)
      this.stage = 2;

    // create your own fun hive with this cool brand new cells
    this.cells = {
      lab: new laboratoryCell(this),
      spawn: new respawnCell(this),
      defense: new defenseCell(this),
    };

    if (this.stage == 0)
      this.cells.dev = new developmentCell(this, this.room.controller!, this.room.find(FIND_SOURCES));
    else {
      this.cells.storage = new storageCell(this, this.room.storage!);
      this.cells.upgrade = new upgradeCell(this, this.room.controller!);
      this.cells.excavation = new excavationCell(this);

      this.builder = new builderMaster(this);
      if (this.stage == 2) {
        // TODO cause i haven' reached yet
      }
    }

    //look for new structures for those wich need them
    this.updateCellData();
    this.repairSheet = new repairSheet(this.stage);
    this.shouldRecalc = true;
  }

  addAnex(annexName: string) {
    if (!this.annexNames.includes(annexName)) {
      this.annexNames.push(annexName);
    }
    if (annexName in Game.rooms) {
      this.shouldRecalc = true;
      return OK;
    } else
      return ERR_NOT_FOUND;
  }

  updateRooms(): void {
    this.room = Game.rooms[this.roomName];
    this.annexes = <Room[]>_.compact(_.map(this.annexNames, (annexName) => {
      let annex = Game.rooms[annexName];
      return annex;
    }));
    this.rooms = [this.room].concat(this.annexes);
  }

  // actually needs to be done only once, but well couple times each reboot is not worst scenario
  markResources() {
    _.forEach(this.rooms, (room) => {
      _.forEach(room.find(FIND_SOURCES), (s) => {
        if (!Game.flags["mine_" + s.id]) {
          let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_YELLOW);
          if (typeof flag == "string")
            Game.flags[flag].memory.hive = this.roomName;
        }
      });
    });

    _.forEach(this.room.find(FIND_MINERALS), (s) => {
      if (!Game.flags["mine_" + s.id]) {
        let flag = s.pos.createFlag("mine_" + s.id, COLOR_YELLOW, COLOR_CYAN);
        if (typeof flag == "string")
          Game.flags[flag].memory.hive = this.roomName;
      }
    });
  }

  private updateCellData() {
    let extensions = this.cells.spawn.extensions;
    let spawns = this.cells.spawn.spawns;
    let towers = this.cells.defense.towers;
    let laboratories: StructureLab[] | undefined;
    if (this.cells.lab)
      laboratories = this.cells.lab.laboratories;

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureExtension && structure.isActive() && !extensions.includes(structure))
        extensions.push(structure);
      else if (structure instanceof StructureSpawn && structure.isActive() && !spawns.includes(structure))
        spawns.push(structure);
      else if (structure instanceof StructureTower && structure.isActive() && !towers.includes(structure))
        towers.push(structure);
      else if (laboratories && structure instanceof StructureLab && structure.isActive() && !laboratories.includes(structure))
        laboratories.push(structure);
    });
  }

  private updateConstructionSites(rooms?: Room[]) {
    this.constructionSites = [];
    _.forEach(rooms ? rooms : this.rooms, (room) => {
      let roomInfo = Apiary.intel.getInfo(room.name, 10);
      if (roomInfo.safePlace)
        this.constructionSites = this.constructionSites.concat(_.filter(room.find(FIND_CONSTRUCTION_SITES), (site) => site.my));
    });
  }

  private updateRepairs() {
    this.normalRepairs = [];
    this.emergencyRepairs = [];
    _.forEach(this.room.find(FIND_STRUCTURES), (structure) => {
      if (this.repairSheet.isAnEmergency(structure))
        this.emergencyRepairs.push(structure);
      else if (this.repairSheet.isAnRepairCase(structure))
        this.normalRepairs.push(structure);
    });
    _.forEach(this.annexes, (room) => {
      let roomInfo = Apiary.intel.getInfo(room.name, 10);
      if (roomInfo.safePlace)
        _.forEach(room.find(FIND_STRUCTURES), (structure) => {
          if (structure.structureType == STRUCTURE_ROAD || structure.structureType == STRUCTURE_CONTAINER)
            if (this.repairSheet.isAnEmergency(structure))
              this.emergencyRepairs.push(structure);
            else if (this.repairSheet.isAnRepairCase(structure))
              this.normalRepairs.push(structure);
        });
    });
  }

  updateLog() {
    if (!Memory.log.hives[this.roomName])
      Memory.log.hives[this.roomName] = {};
    let orderMap: { [id: string]: { amount: number, priority: number } } = {};
    for (const master in this.spawOrders) {
      orderMap[master] = {
        amount: this.spawOrders[master].amount,
        priority: this.spawOrders[master].priority,
      };
    }
    Memory.log.hives[this.roomName][Game.time] = {
      annexNames: this.annexNames,
      constructionSites: this.constructionSites.length,
      emergencyRepairs: this.emergencyRepairs.length,
      normalRepairs: this.normalRepairs.length,
      spawOrders: orderMap,
    };
  }

  update() {
    // if failed the hive is doomed
    this.room = Game.rooms[this.roomName];
    if (UPDATE_EACH_TICK || Game.time % 10 == 8 || this.shouldRecalc) {
      this.updateRooms();
      this.updateConstructionSites();
      if (UPDATE_EACH_TICK || Game.time % 30 == 8 || this.shouldRecalc)
        this.updateRepairs(); // cause costly
      if (this.shouldRecalc) {
        this.markResources();
        this.shouldRecalc = false;
      }
    }

    if (Game.time % 100 == 29)
      this.updateCellData();
    if (Game.time % LOGGING_CYCLE == 0)
      this.updateLog();

    if (UPDATE_EACH_TICK)
      _.forEach(this.cells, (cell) => { Cell.prototype.update.call(cell); });

    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.update(), cell.print + " update");
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      safeWrap(() => cell.run(), cell.print + " run");
    });
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>[Hive ${this.roomName}]</a>`;
  }
}
