let roleKnight = {
  run: function(creep) {
    let orders = creep.memory.orders;
    if (orders.move) {
      creep.moveTo(new RoomPosition(orders.move.x, orders.move.y, creep.roomName));
    }
    if (creep.memory.orders.attack) {
      creep.attack(Game.getObjectById(creep.memory.orders.attack));
    }
  },

  coolName: "Fire ant ",
  spawn: function(room) {
    let roleName = "knight";
    let orderInfo = _.get(room.memory, ["army_orders", roleName]);

    if (Game.time % OUTPUT_TICK == 0) {
      let status = "no order"
      if (orderInfo) {
        status = "ordered " + orderInfo.count;
      }
      console.log("knights: " + status);
    }


    if (!orderInfo) {
      return
    }

    let spawnSettings = {
      bodyParts: [],
      memory: {}
    }
    let roomEnergy = room.energyCapacityAvailable;

    let segment = [TOUGH, ATTACK, MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let sumCost = 0;

    for (let i = 0; sumCost + segmentCost <= roomEnergy &&
      spawnSettings.bodyParts.length + segment.length <= 50; ++i) {
      _.forEach(segment, (s) => spawnSettings.bodyParts.push(s));
      sumCost += segmentCost;

      if (i % 2 == 0) {
        segment = [ATTACK, ATTACK, MOVE];
      } else if (i % 4 == 1) {
        segment = [TOUGH, ATTACK, MOVE];
      } else if (i % 4 == 3) {
        segment = [TOUGH, TOUGH, MOVE];
      }
      segmentCost = _.sum(segment, s => BODYPART_COST[s]);
    }



    segment = [TOUGH, TOUGH, MOVE];
    segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    if (sumCost + segmentCost <= roomEnergy &&
      spawnSettings.bodyParts.length + segment.length <= 50) {
      _.forEach(segment, (s) => spawnSettings.bodyParts.push(s));
      sumCost += segmentCost;
    }

    spawnSettings.memory = {
      role: roleName,
      born: Game.time,
      army_name: orderInfo.armyName,
      orders: {
        attack: 0,
        move: 0
      }
    };

    spawnSettings.postSpawn = function() {
      room.memory.army_orders[roleName].count -= 1
      if (room.memory.army_orders[roleName].count <= 0) {
        delete room.memory.army_orders[roleName];
      }
    };

    return spawnSettings;
  },
}

module.exports = roleKnight;