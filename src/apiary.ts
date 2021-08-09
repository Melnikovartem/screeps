import { Hive } from "./Hive"
import { Bee } from "./bee"

export class _Apiary {
  hives: Hive[] = [];
  destroyTime: number;


  constructor() {
    this.destroyTime = Game.time + 2000;

    let myRoomsAnnexes: { [id: string]: string[] } = {};

    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        myRoomsAnnexes[room.name] = [];
    });

    _.forEach(Game.flags, (flag) => {
      // annex room
      if (flag.color == 2 && flag.secondaryColor == 2) {
        _.some(Game.map.describeExits(flag.pos.roomName), (exit) => {
          if (exit && myRoomsAnnexes[exit] && !myRoomsAnnexes[exit].includes(flag.pos.roomName)) {
            myRoomsAnnexes[exit].push(flag.pos.roomName);
            return true;
          }
          return false;
        });
      }
    });

    _.forEach(myRoomsAnnexes, (annexNames, roomName) => {
      if (roomName)
        this.hives.push(new Hive(roomName, annexNames));
    });
  }

  // update phase
  update() {

    _.forEach(this.hives, (hive) => {
      hive.update();
    });

    // after all the masters where created and retrived if it was needed
    for (const name in Memory.creeps) {
      let creep = Game.creeps[name];
      if (creep)
        if (!global.bees[name]) {
          if (global.masters[creep.memory.refMaster]) {
            // not sure if i rly need a global bees hash
            global.bees[creep.name] = new Bee(creep);
            global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
          } else if (creep.memory.refMaster.includes("master_developmentCell_")) {
            // TODO think of something smart
            let randomMaster = Object.keys(global.masters)[Math.floor(Math.random() * Object.keys(global.masters).length)];
            creep.memory.refMaster = randomMaster;

            global.bees[creep.name] = new Bee(creep);
            global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
          }
          // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
        } else {
          // i guess it is not gonna be fixed :/
          global.bees[name].creep = creep;
        }
      else if (global.bees[name])
        delete global.bees[name];
    }

    _.forEach(global.masters, (master) => {
      master.update();
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      hive.run();
    });
    _.forEach(global.masters, (master) => {
      master.run();
    });
  }
}
