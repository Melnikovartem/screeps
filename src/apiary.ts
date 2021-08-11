import { Hive } from "./Hive";
import { Bee } from "./bee";

import { Intel } from "./intelligence";

import { hordeMaster } from "./beeMaster/war/horde";
import { SwarmMaster } from "./beeMaster/_SwarmMaster";

import { UPDATE_EACH_TICK } from "./settings";

export class _Apiary {
  hives: { [id: string]: Hive } = {};
  destroyTime: number;

  intel: Intel;

  constructor() {
    this.destroyTime = Game.time + 2000;

    this.intel = new Intel();

    let myRoomsAnnexes: { [id: string]: string[] } = {};

    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        myRoomsAnnexes[room.name] = [];
    });

    _.forEach(Game.flags, (flag) => {
      // annex room
      if (flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE) {
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
        this.hives[roomName] = new Hive(roomName, annexNames);
    });
  }

  updateFlags() {
    // act upon flags
    if (Object.keys(this.hives).length)
      _.forEach(Game.flags, (flag) => {
        // annex room
        if (flag.color == COLOR_BLUE && flag.secondaryColor == COLOR_BLUE) {
          let master = (<SwarmMaster>global.masters["master_Swarm_" + flag.name]);
          if (!master) {
            let homeRoom: string = Object.keys(this.hives)[Math.floor(Math.random() * Object.keys(this.hives).length)];
            _.forEach(Game.map.describeExits(flag.pos.roomName), (exit) => {
              if (this.hives[<string>exit] && this.hives[homeRoom].stage > this.hives[<string>exit].stage) {
                homeRoom = <string>exit;
              }
            });
            new hordeMaster(this.hives[homeRoom], flag);
          } else if (master.destroyTime < Game.time) {
            delete global.masters["master_Swarm_" + flag.name];
            flag.remove();
          } else if (UPDATE_EACH_TICK || Game.time % 10 == 0) {
            master.order = flag;
          }
        }
      });
  }

  updateBees() {
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
  }

  // update phase
  update() {

    _.forEach(this.hives, (hive) => {
      hive.update();
    });

    this.updateFlags();
    this.updateBees();


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
