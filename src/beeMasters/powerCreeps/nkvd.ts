import { PowerMaster } from "../_PowerMaster";

import { profile } from "../../profiler/decorator";


// nkvd'shnik

@profile
export class NKVDMaster extends PowerMaster {
  nextup?: { target: Structure, power: PowerConstant };

  update() {
    super.update();

    _.forEach(this.powerCreep.powers, (info, power) => {

    });
  }

  run() {
  }
}
