// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import { Master } from "./_Master";
import { prefix } from "../enums";

import { profile } from "../profiler/decorator";
import type { Hive } from "../Hive";

@profile
export abstract class PowerMaster extends Master {

  readonly powerCreep: PowerCreep;

  constructor(hive: Hive, powerCreep: PowerCreep) {
    super(hive, powerCreep.name);

    this.powerCreep = powerCreep;
  }


  static checkPowerCreeps() {
    _.forEach(Game.powerCreeps, pc => {
      if (!Apiary.masters[prefix.master + pc.name]) {
        let validHives = _.filter(Apiary.hives, h => h.cells.power && !h.powerManager);
        console.log(validHives, pc.name);
      }
    });
  }
}
