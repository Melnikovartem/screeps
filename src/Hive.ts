import { excavationCell } from "./cells/excavationCell";
import { storageCell } from "./cells/storageCell";
import { upgradeCell } from "./cells/upgradeCell";
import { defenseCell } from "./cells/defenseCell";
import { respawnCell } from "./cells/respawnCell";
import { developmentCell } from "./cells/developmentCell";

import { builderMaster } from "./beeMaster/builder";

import { CreepSetup } from "./creepSetups";

// TODO visuals
// const VISUALS_ON = true;

export interface spawnOrder {
  master: string;
  amount: number;
  setup: CreepSetup;
}

interface hiveCells {
  respawnCell?: respawnCell;
  excavationCell?: excavationCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
  developmentCell?: developmentCell;
  defenseCell?: defenseCell;
}

class repairSheet {
  [STRUCTURE_RAMPART]: number = 200000;
  [STRUCTURE_WALL]: number = 200000;
  other: number = 1;
  collapse: number = 0.5;

  isAnEmergency(structure: Structure): boolean {
    switch (structure.structureType) {
      case STRUCTURE_RAMPART: case STRUCTURE_WALL: {
        return structure.hits < this[structure.structureType] * this.collapse;
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


export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  room: Room;
  annexes: Room[]; // this room and annexes
  rooms: Room[]; //this room and annexes
  cells: hiveCells;
  repairSheet: repairSheet;

  orderList: spawnOrder[] = [];

  //targets for defense systems
  roomTargets: Creep[] = [];
  annexTargets: Creep[] = [];

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];

  builder: builderMaster;

  constructor(roomName: string, annexNames: string[]) {
    this.room = Game.rooms[roomName];
    this.annexes = _.compact(_.map(annexNames, (annexName) => Game.rooms[annexName]));
    this.rooms = [this.room].concat(this.annexes);

    this.repairSheet = new repairSheet();

    this.cells = {};
    this.parseStructures();

    this.builder = new builderMaster(this);
  }

  private parseStructures() {
    this.updateConstructionSites();
    this.updateEmeregcyRepairs();
    this.updateNormalRepairs();

    let spawns: StructureSpawn[] = [];
    let extensions: StructureExtension[] = [];
    let towers: StructureTower[] = [];

    _.forEach(this.room.find(FIND_MY_STRUCTURES), (structure) => {
      if (structure instanceof StructureSpawn && structure.isActive())
        spawns.push(structure);
      else if (structure instanceof StructureExtension && structure.isActive())
        extensions.push(structure);
      else if (structure instanceof StructureTower && structure.isActive())
        towers.push(structure);
    });

    let storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;
    if (storage) {
      this.cells.storageCell = new storageCell(this, storage);

      this.cells.upgradeCell = new upgradeCell(this, this.room.controller!);

      let allSources: Source[] = [];
      _.forEach(this.rooms, (room) => {
        let sources = room.find(FIND_SOURCES);
        allSources = allSources.concat(sources);
      });
      if (allSources.length) {
        this.cells.excavationCell = new excavationCell(this, allSources);
      }

      this.cells.respawnCell = new respawnCell(this, spawns, extensions);
    } else {
      this.cells.developmentCell = new developmentCell(this, this.room.controller!);
    }

    if (towers.length) {
      this.cells.defenseCell = new defenseCell(this, towers);
    }
  }

  private updateConstructionSites() {
    this.constructionSites = [];
    _.forEach(this.rooms, (room) => {
      this.constructionSites = this.constructionSites.concat(room.find(FIND_CONSTRUCTION_SITES));
    });
  }


  private updateEmeregcyRepairs() {
    this.emergencyRepairs = [];
    _.forEach(this.rooms, (room) => {
      this.emergencyRepairs = this.emergencyRepairs.concat(
        _.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnEmergency(structure)))
    });
  }

  private updateNormalRepairs() {
    this.normalRepairs = [];
    _.forEach(this.rooms, (room) => {
      this.normalRepairs = this.normalRepairs.concat(
        _.filter(room.find(FIND_STRUCTURES), (structure) => this.repairSheet.isAnRepairCase(structure)))
    });
  }

  // look for targets inside room
  private findTargets() {
    this.roomTargets = _.filter(this.room.find(FIND_HOSTILE_CREEPS),
      (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL));
    this.annexTargets = [];
    _.forEach(this.annexes, (room) => {
      this.annexTargets = this.annexTargets.concat(
        _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL)))
    });
  }

  // add to list a new creep
  wish(order: spawnOrder) {
    // add some checks
    this.orderList.push(order)
  }

  updateRooms(): void {
    this.room = Game.rooms[this.room.name];
    this.annexes = _.compact(_.map(this.annexes, (annex) => Game.rooms[annex.name]));
    this.rooms = [this.room].concat(this.annexes);
  }

  update() {
    if (Game.time % 5 == 0) {
      this.updateConstructionSites();
      this.updateEmeregcyRepairs();
      this.updateNormalRepairs();
    } else if (Game.time % 5 == 1) {
      this.findTargets();
    } else if (Game.time % 5 == 2) {
      this.updateRooms();
    }

    _.forEach(this.cells, (cell) => {
      cell.update();
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      cell.run();
    });
  }
}