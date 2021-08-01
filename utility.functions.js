global.createArmy = function(armyName, roomName) {
  if (!_.get(Memory, ["armies", armyName])) {
    let armyData = {
      target: roomName,
      stationed: roomName,
      roles: {},
      high_alert: 0, // do we need to check room each tick
      replenished: 0, // is process of replenishment finished
      reuse_path: 5, // how smart do we need to be with our moves
      enenmies: {}
    };
    _.set(Memory, ["armies", armyName], armyData);
  }
}

global.addSolider = function(armyName, role, amount = 1) {
  if (!Object.keys(ROLES).includes(role)) {
    return ERR_NOT_FOUND;
  }

  let army = Memory.armies[armyName];

  if (army) {
    if (army.roles[role]) {
      army.roles[role] += amount;
    } else {
      army.roles[role] = amount;
    }

    if (army.roles[role] <= 0) {
      delete army.roles[role];
      return OK;
    } else {
      army.replenished == 0;
      return army.roles[role];
    }
  } else {
    return ERR_NOT_FOUND;
  }
}