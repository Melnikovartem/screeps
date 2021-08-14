import { Bee } from "../../bee";
import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { makeId } from "../../utils";
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
type ReactionConstant = "G" | "OH" | "X" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";

const reactionMap: { [key in ReactionConstant]?: { res1: BaseMineral | ReactionConstant, res2: BaseMineral | ReactionConstant } } = {};
for (let res1 in REACTIONS) {
  for (let res2 in REACTIONS[res1])
    reactionMap[<ReactionConstant>REACTIONS[res1][res2]] = {
      res1: <BaseMineral | ReactionConstant>res1,
      res2: <BaseMineral | ReactionConstant>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  start: number,
  amount: number,
  resource: ReactionConstant,
};

@profile
export class laboratoryCell extends Cell {
  laboratories: StructureLab[] = [];
  // inLab check for delivery system
  inLab: { [id: string]: { resource: BaseMineral | ReactionConstant | null, amount: number } } = {};
  boostRequests: { [id: string]: { bee: Bee, amount: number, resource: ResourceConstant } } = {};
  synthesizeRequests: { [id: string]: SynthesizeRequest } = {};

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  getAmount(resource: BaseMineral | ReactionConstant) {
    let amount = 0;
    _.forEach(this.inLab, (labData) => {
      if (labData.resource == resource)
        amount += labData.amount;
    });
    return amount;
  }

  changeAmount(lab: StructureLab, resource: BaseMineral | ReactionConstant | null, amount: number) {
    if (!this.inLab[lab.id])
      this.inLab[lab.id] = {
        resource: null,
        amount: 0,
      };
    if (resource && resource != this.inLab[lab.id].resource)
      this.inLab[lab.id] = {
        resource: resource,
        amount: lab.store.getUsedCapacity(resource),
      }
    this.inLab[lab.id].amount += amount;
    if (this.inLab[lab.id].amount <= 0)
      this.inLab[lab.id] = {
        resource: resource,
        amount: 0,
      }
  }

  getLabsFree(resource: BaseMineral | ReactionConstant, amount?: number, sorted?: boolean, promised?: boolean): StructureLab[] {
    let labs: StructureLab[]
    if (promised)
      labs = _.filter(this.laboratories, (lab) => lab.store.getFreeCapacity(resource) > (amount ? amount : 0)
        && (!this.inLab[lab.id].resource || this.inLab[lab.id].resource == resource));
    else
      labs = _.filter(this.laboratories, (lab) => lab.store.getFreeCapacity(resource) > (amount ? amount : 0)
        && (!lab.mineralType || resource == lab.mineralType));

    if (sorted)
      labs.sort((a, b) => b.store.getFreeCapacity(resource) - a.store.getFreeCapacity(resource));

    return labs;
  }

  getLabsFull(resource: BaseMineral | ReactionConstant, amount?: number, sorted?: boolean): StructureLab[] {
    let labs = _.filter(this.laboratories, (lab) => lab.store.getUsedCapacity(resource) > (amount ? amount : 0)
      && resource == lab.mineralType);
    if (sorted)
      labs.sort((a, b) => b.store.getFreeCapacity(resource) - a.store.getFreeCapacity(resource));
    return labs;
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number): number {
    if (!amount) {
      amount = 0;
      let mainStore = this.hive.cells.storage && this.hive.cells.storage.storage.store;
      if (mainStore) {
        let res1 = reactionMap[resource]!.res1;
        let res2 = reactionMap[resource]!.res2;

        amount = Math.min(mainStore[res1] * 5, mainStore[res2] * 5);
      }
    }
    if (amount > 0)
      this.synthesizeRequests[resource + "_" + amount + "_" + makeId(6)] = {
        start: amount,
        amount: amount,
        resource: resource,
      };
    return amount;
  }

  toStorage(res: ReactionConstant, amount: number, ref?: string): number {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      let sum = 0
      let labs: StructureLab[] = []
      _.some(this.getLabsFull(res), (lab) => {
        sum += Math.min(lab.store.getUsedCapacity(res), amount - sum);
        this.changeAmount(lab, res, -Math.min(lab.store.getUsedCapacity(res), amount - sum));
        labs.push(lab);
        return sum == amount;
      });
      ref = ref ? ref : makeId(6)
      storageCell.requests[ref] = {
        to: [storageCell.storage],
        from: labs,
        resource: res,
        amount: amount,
        priority: 3,
      }
      this.print(ref + ": " + sum + " ? " + amount + " " + res);
      return sum;
    }
    return -1;
  }

  update() {
    super.update();

    if (this.laboratories.length) {
      // fix fuckups and reboots
      if (Game.time % 100 == 29 || this.laboratories.length != Object.keys(this.inLab).length)
        _.forEach(this.laboratories, (lab) => {
          if (!this.inLab[lab.id] || this.inLab[lab.id].resource != lab.mineralType)
            this.changeAmount(lab, lab.mineralType, 0);
          else if (lab.mineralType && this.inLab[lab.id].amount < lab.store[lab.mineralType])
            this.changeAmount(lab, lab.mineralType, lab.store[lab.mineralType] - this.inLab[lab.id].amount);
        });

      let storageCell = this.hive.cells.storage;
      if (storageCell) {
        let storageRequests: { [id: string]: number } = {};

        // bring to synthesize
        for (let key in this.synthesizeRequests) {
          let amount = Math.ceil(this.synthesizeRequests[key].amount * 5);
          let res1 = reactionMap[this.synthesizeRequests[key].resource]!.res1;
          let res2 = reactionMap[this.synthesizeRequests[key].resource]!.res2;


          let res1Amount = this.getAmount(res1);
          let res2Amount = this.getAmount(res2);

          if (res1Amount < amount || res2Amount < amount) {

            if (res1Amount + (storageCell.storage.store[res1] ? storageCell.storage.store[res1] : 0) < amount
              || res2Amount + (storageCell.storage.store[res2] ? storageCell.storage.store[res2] : 0) < amount)
              delete this.synthesizeRequests[key];
            else {
              if (res1Amount < amount) {
                if (!storageRequests[res1])
                  storageRequests[res1] = 0;
                storageRequests[res1] += amount;
              }

              if (res2Amount < amount) {
                if (!storageRequests[res2])
                  storageRequests[res2] = 0;
                storageRequests[res2] += amount;
              }
            }
          }
        }

        // bring to boost
        // TODO: boosting

        for (let res in storageRequests) {
          let resource: ReactionConstant = <ReactionConstant>res;
          let labs: StructureLab[] = [];
          let allAmount = 0;
          while (storageRequests[resource] > allAmount) {
            let amount = Math.min(storageRequests[resource] - allAmount, LAB_MINERAL_CAPACITY);
            let lab = this.getLabsFree(resource, amount, true, true)[0];
            if (lab) {
              this.inLab[lab.id].amount += amount;
              allAmount += amount;
              labs.push(lab);
            } else
              storageRequests[resource] = 0;
          }
          storageCell.requestFromStorage(this.ref + "_" + resource, labs, 5, allAmount, resource);
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
    if (this.laboratories.length && (Object.keys(this.synthesizeRequests).length || Object.keys(this.boostRequests).length)) {
      for (let key in this.synthesizeRequests) {
        let request = this.synthesizeRequests[key];
        if (request.amount > 0) {
          let res1 = reactionMap[request.resource]!.res1;
          let res2 = reactionMap[request.resource]!.res2;

          let lab1 = this.getLabsFull(res1)[0];
          let lab2 = this.getLabsFull(res2)[0];

          if (lab1 && lab2) {
            let lab = _.filter(this.getLabsFree(request.resource), (lab) => lab.cooldown == 0)[0];
            if (lab && lab.runReaction(lab1, lab2) == OK) {
              console.log(res1, "+", res2, '=>', request.resource);
              this.changeAmount(lab1, res1, -1);
              this.changeAmount(lab2, res2, -1);
              this.changeAmount(lab2, request.resource, 5);
              request.amount -= 5;
            }
          }
        } else if (request.start > 0) {
          request.start = 0;
          this.toStorage(request.resource, request.start, key);
        } else
          delete this.synthesizeRequests[key];
      }
    }
  }
}

// Apiary.hives["E21S57"].cells.lab.newSynthesizeRequest("OH", 20)
// Apiary.hives["E21S57"].cells.lab.toStorage("O", 10)
