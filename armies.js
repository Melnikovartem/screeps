function checkRoom(room) {
  let enemy_creeps = room.find(FIND_HOSTILE_CREEPS);

  let enemy_structures = room.find(FIND_HOSTILE_STRUCTURES, {
    filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
      structure.structureType == STRUCTURE_INVADER_CORE
  });

  let enemies = {
    ...enemy_structures,
    ...enemy_creeps
  }

  if (!enemies) {
    enemies = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_SPAWN ||
        structure.structureType == STRUCTURE_POWER_SPAWN
    });
  }

  return enemies;
}


function checkSafeRoom(army) {
  let enemy_creeps = room.find(FIND_HOSTILE_CREEPS);

  let enemy_structures = room.find(FIND_HOSTILE_STRUCTURES, {
    filter: (structure) => structure.structureType == STRUCTURE_RAMPART ||
      structure.structureType == STRUCTURE_EXTENSION
  });

  let enemies = {
    ...enemy_structures,
    ...enemy_creeps
  }

  return enemies;
}


function armyLoop() {
  for (let armyName in Memory.armies) {
    //let prevCPU = Game.cpu.getUsed();
    //right now more like a mob that comes in room
    let army = Memory.armies[armyName];
    let stationedRoom = Game.rooms[army.stationed];

    let enemies;
    //check room depending on situation
    if (army.high_alert) {
      enemies = checkRoom(stationedRoom);
    } else if (stationedRoom.controller.my && Game.time % 100 == 0) {
      enemies = checkRoom(stationedRoom);
    } else if (Game.time % 50 == 0) {
      enemies = checkRoom(stationedRoom);
    }

    let soliders = _.filter(Game.creeps, (creep) => creep.memory.army_name == armyName);

    if (stationedRoom.controller.my) {
      if (army.replenished == 0 || Game.time % 50 == 0) {
        let armyFull = 1;
        // if needed the room will start replenishing
        _.forEach(Object.keys(army.roles), function(roleName) {
          let diff = army.roles[roleName] - _.filter(soliders, (creep) => creep.memory.role == roleName).length
          if (diff > 0) {
            armyFull = 0;
          }

          // !!!!!! this is too heavy?!
          let inProcess = _.get(stationedRoom.memory, ["army_orders", roleName]) +
            stationedRoom.find(FIND_MY_STRUCTURES, (structure) => structure.Spawning && structure.Spawning.role == roleName);


          if (inProcess) {
            diff -= inProcess.count;
          }

          if (diff > 0) {
            // those in process not enough
            if (!stationedRoom.memory.army_orders) {
              stationedRoom.memory.army_orders = {};
            }
            stationedRoom.memory.army_orders[roleName] = {
              armyName: armyName,
              count: diff
            };
            console.log("New " + armyName + " order for " + diff + " " + roleName);
          }
        });
        if (armyFull) {
          army.replenished = 1;
        } else {
          army.replenished = 0;
        }
      }
    }

    if (soliders.length == 0 && !stationedRoom.controller.my) {
      delete Memory.armies[armyName];
    } else if (enemies) {
      // time to fight enemies should be defined
      army.high_alert = 1;
      army.reuse_path = 0;

    } else {
      army.high_alert = 0;
      army.reuse_path = 10;

      if (army.stationed != army.target && army.replenished) {
        // move to next room
      } else {
        let enemies = checkSafeRoom(stationedRoom);
        if (enemies) {
          // pillage?

        } else {
          //chose a spot and chill?

        }
      }
    }
    // if (Game.time % 2 == 0) {
    //  console.log("On inProcess: " + (Game.cpu.getUsed() - prevCPU));
    //}
  }
}


module.exports = armyLoop;