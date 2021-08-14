import { Bee } from "../../bee";
import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";

/*
// i rly don't like to type in all the reactions;
let s: string[] = []; REACTION_TIME
for (let key in REACTIONS)
  if (!s.includes(key))
    s.push(key);
for (let key in REACTION_TIME) {
  if (!s.includes(key))
    s.push(key);
}
let ss = "";
for (let key in s)
  ss += " | " + '"' + s[key] + '"';
console.log(ss);
*/

type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U"
type ResourceLab = "G" | "OH" | "X" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";

const reactionMap: { [key in ResourceLab]?: { res1: BaseMineral | ResourceLab, res2: BaseMineral | ResourceLab } } = {};
for (let res1 in REACTIONS) {
  for (let res2 in REACTIONS[res1])
    reactionMap[<ResourceLab>REACTIONS[res1][res2]] = {
      res1: <BaseMineral | ResourceLab>res1,
      res2: <BaseMineral | ResourceLab>res2,
    };
}
//reaction map done

interface SynthesizeRequest {
  amount: number,
  start: number,
  resource: ResourceLab,
};

@profile
export class laboratoryCell extends Cell {
  laboratories: StructureLab[] = [];
  // inLab id - ResourceConstant
  inLab: { [id: string]: number } = {};
  boostRequests: { bee: Bee, amount: number, resource: ResourceConstant }[] = [];
  synthesizeRequests: SynthesizeRequest[] = [];

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);

    for (let reaction in REACTION_TIME)
      this.inLab[reaction] = 0;
  }

  update() {
    super.update();

    if (this.laboratories.length) {
      let storageCell = this.hive.cells.storage;
      if (storageCell) {
        let storageRequests: { [id: string]: number } = {};

        // bring to synthesize
        for (let key in this.synthesizeRequests) {
          let amount = Math.ceil(this.synthesizeRequests[key].amount / 5);
          let res1 = reactionMap[this.synthesizeRequests[key].resource]!.res1;
          let res2 = reactionMap[this.synthesizeRequests[key].resource]!.res2;

          if ((storageCell.storage.store[res1] < amount && this.inLab[res1] < amount)
            || (storageCell.storage.store[res2] < amount && this.inLab[res2] < amount))
            delete this.synthesizeRequests[key];
          else {
            if (this.inLab[res1] < amount) {
              if (!storageRequests[res1])
                storageRequests[res1] = 0;
              storageRequests[res1] += amount;
            }

            if (this.inLab[res2] < amount) {
              if (!storageRequests[res2])
                storageRequests[res2] = 0;
              storageRequests[res2] += amount;
            }
          }
        }

        // bring to boost
        // TODO: boosting

        for (let res in storageRequests) {
          let resource: ResourceLab = <ResourceLab>res;
          while (storageRequests[resource] > 0) {
            let amount = Math.min(storageRequests[resource], LAB_MINERAL_CAPACITY);
            storageRequests[resource] -= LAB_MINERAL_CAPACITY;
            let lab = _.filter(this.laboratories, (lab) => lab.store.getFreeCapacity(resource) >= amount)[0];
            if (lab) {
              amount = storageCell.requestFromStorage(this.ref + "_" + resource, [lab], 5, amount, resource);
              if (amount > 0)
                this.inLab[resource] += amount;
            }
          }
        }

        let energySum = 0;
        let energyNeededLabs = _.filter(this.laboratories, (lab) => {
          energySum += lab.store.getFreeCapacity(RESOURCE_ENERGY);
          if (lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 4)
            energySum += LAB_ENERGY_CAPACITY;
          return lab.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (energySum > LAB_ENERGY_CAPACITY / 2)
          storageCell.requestFromStorage(this.ref, energyNeededLabs, energySum > LAB_ENERGY_CAPACITY * 2 ? 2 : 4);
      }
    }
  }

  run() {
    if (this.laboratories.length && (this.synthesizeRequests.length || this.boostRequests.length)) {
      for (let key in this.synthesizeRequests) {
        let request = this.synthesizeRequests[key];
        if (request.amount > 0) {
          let res1 = reactionMap[request.resource]!.res1;
          let res2 = reactionMap[request.resource]!.res2;

          let lab1 = _.filter(this.laboratories, (lab) => lab.store[res1] > 1)[0];
          let lab2 = _.filter(this.laboratories, (lab) => lab.store[res2] > 1)[0];

          if (lab1 && lab2) {
            let lab = _.filter(this.laboratories, (lab) => !lab.cooldown && lab.store.getFreeCapacity(request.resource) > 5)[0];
            if (lab && lab.runReaction(lab1, lab2) == OK) {
              this.inLab[res1] -= 1;
              this.inLab[res1] -= 1;
              this.inLab[request.resource] += 5;
              request.amount -= 5;
            }
          }
        } else {
          let storageCell = this.hive.cells.storage;
          if (storageCell) {
          }
        }
      }
    }
  }
}
