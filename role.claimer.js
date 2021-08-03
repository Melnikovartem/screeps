let roleName = "claimer";
let roleClaimer = {
  run: function(creep) {
    // this guy prob never leaves target_room
    if (creep.room.name == creep.memory.target_room) {
      if (creep.pos.getRangeTo(creep.room.controller) > 3) {
        creep.moveTo(creep.room.controller, {
          reusePath: REUSE_PATH
        });
      } else {
        creep.reserveController(creep.room.controller);
      }
    } else {
      creep.moveToRoom(creep.memory.target_room);
    }
  },

  coolName: "Bee drone ",
  spawn: function(room) {

    let spawnSettings = {
      bodyParts: [],
      memory: {}
    }

    if (room.memory.annexes) {
      for (let annexName in room.memory.annexes) {
        if (room.memory.annexes[annexName].reservation) {
          let reservationData = room.memory.annexes[annexName].reservation;
          if (Game.time + reservationData.route_time >= reservationData.last_spawned + CREEP_LIFE_TIME) {
            let roomEnergy = room.energyCapacityAvailable;

            let segment = [MOVE, CLAIM];
            let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

            let maxSegment = Math.floor(roomEnergy / segmentCost);
            // for now
            maxSegment = Math.min(maxSegment, 2)

            _.forEach(segment, function(s) {
              _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
            });

            spawnSettings.memory = {
              role: roleName,
              born: Game.time,
              homeroom: room.name,
              target_room: annexName,
            };

            spawnSettings.postSpawn = function(creepName) {
              reservationData.last_spawned = Game.time;
              console.log("spawned a " + roleName + " named " + creepName + " in " + room.name + " to claim " + annexName);
            };

            return spawnSettings;
          }
        }
      }
    }
  },
}

module.exports = roleClaimer;