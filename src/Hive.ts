import { excavationCell } from "./cells/excavationCell"
import { storageCell } from "./cells/storageCell"
import { upgradeCell } from "./cells/upgradeCell"


const VISUALS_ON = true;

interface hiveCells {
  excavationCell?: excavationCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
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

  // some structures (aka preprocess of filters)
  constructionSites: ConstructionSite[] = [];
  emergencyRepairs: Structure[] = [];
  normalRepairs: Structure[] = [];

  // some shit inherited from room object
  storage: StructureStorage | undefined;
  links: StructureLink[] | undefined;

  constructor(roomName: string, annexNames: string[]) {
    this.room = Game.rooms[roomName];
    this.annexes = _.compact(_.map(annexNames, (annexName) => Game.rooms[annexName]));
    this.rooms = [this.room].concat(this.annexes);

    this.storage = this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined;

    this.repairSheet = new repairSheet();

    this.cells = {};
    this.parseStructures();
  }

  private parseStructures() {
    this.updateConstructionSites();
    this.updateEmeregcyRepairs();
    this.updateNormalRepairs();

    if (this.storage) {
      this.cells.storageCell = new storageCell(this, this.storage);
    }

    let allSources: Source[] = [];
    _.forEach(this.rooms, (room) => {
      let sources = room.find(FIND_SOURCES);
      allSources.concat(sources);
    });
    if (allSources.length) {
      this.cells.excavationCell = new excavationCell(this, allSources);
    }
  }

  private updateConstructionSites() {
    _.forEach(this.rooms, (room) => {
      let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
      this.constructionSites.concat(constructionSites);
    });
  }


  private updateEmeregcyRepairs() {
    _.forEach(this.rooms, (room) => {
      let emergencyRepairs = _.filter(room.find(FIND_STRUCTURES), this.repairSheet.isAnEmergency);
      this.emergencyRepairs.concat(emergencyRepairs);
    });
  }

  private updateNormalRepairs() {
    _.forEach(this.rooms, (room) => {
      let normalRepairs = _.filter(room.find(FIND_STRUCTURES), this.repairSheet.isAnRepairCase);
      this.normalRepairs.concat(normalRepairs);
    });
  }

  // add to list a new creep
  wish() {

  }

  update() {
    if (Game.time % 5 == 0) {
      this.updateConstructionSites();
      this.updateEmeregcyRepairs();
      this.updateNormalRepairs();
    }

    _.forEach(this.cells, (cell) => {
      cell.update();
    });
  }

  run() {
    _.forEach(this.cells, (cell) => {
      cell.update();
    });
  }
}
