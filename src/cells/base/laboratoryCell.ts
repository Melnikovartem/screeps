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

type ReactionConstant = "H" | "O" | "Z" | "L" | "K" | "U" | "G" | "OH" | "X" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";

const reactionMap: { [key in ReactionConstant]?: { res1: ReactionConstant, res2: ReactionConstant } } = {};
for (let res1 in REACTIONS) {
  for (let res2 in REACTIONS[res1])
    reactionMap[<ReactionConstant>REACTIONS[res1][res2]] = {
      res1: <ReactionConstant>res1,
      res2: <ReactionConstant>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  plan: number,
  current: number,
  resource: ReactionConstant,
};

@profile
export class laboratoryCell extends Cell {
  laboratories: StructureLab[] = [];
  // inLab check for delivery system
  boostRequests: { [id: string]: { bee: Bee, amount: number, resource: ResourceConstant } } = {};
  synthesizeRequests: SynthesizeRequest[] = [];
  currentRequest?: SynthesizeRequest;
  lab1: StructureLab | undefined; // with res1
  lab2: StructureLab | undefined; // with res2

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  getLabsFree(resource: ReactionConstant, amount?: number): StructureLab[] {
    let labs = _.filter(this.laboratories, (lab) =>
      lab.store.getFreeCapacity(resource) >= (amount != undefined ? amount : 1)
      && !lab.mineralType || lab.mineralType == resource
      && (!this.lab1 || lab.id != this.lab1.id)
      && (!this.lab2 || lab.id != this.lab2.id));
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

    this.synthesizeRequests.push({
      plan: amount,
      current: amount,
      resource: resource,
    });

    return amount;
  }

  fflush(res: ReactionConstant, amount?: number): number {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (storageCell.requests[this.ref + "_" + res])
        return ERR_TIRED;
      let sum = 0;
      let labs: StructureLab[] = [];
      _.some(this.laboratories, (lab) => {
        if (lab.mineralType == res) {
          if (amount)
            sum += Math.min(lab.store.getUsedCapacity(res), amount - sum);
          labs.push(lab);
        }
        return sum == amount;
      });
      if (labs.length) {
        storageCell.requests[this.ref + "_" + res] = {
          to: [storageCell.storage],
          from: labs,
          resource: res,
          amount: amount,
          priority: 3,
          multipleFrom: true,
        }
        return sum;
      }
      return ERR_NOT_FOUND;
    }
    return ERR_INVALID_ARGS;
  }

  fflushAll() {
    let resources: ReactionConstant[] = [];
    _.forEach(this.laboratories, (lab) => {
      if (lab.mineralType && !resources.includes(lab.mineralType)
        && (!this.lab1 || lab.id != this.lab1.id)
        && (!this.lab2 || lab.id != this.lab2.id))
        resources.push(lab.mineralType)
    });
    _.forEach(resources, (res) => {
      this.fflush(res);
    });
  }

  update() {
    super.update();
    let storageCell = this.hive.cells.storage;
    if (storageCell && this.laboratories.length) {
      let request = this.currentRequest;
      if (request) {
        let res1 = reactionMap[request.resource]!.res1;
        let res2 = reactionMap[request.resource]!.res2;
        if (this.lab1 && this.lab2) {
          let amount = Math.ceil(request.plan / 5);

          if (this.lab1.store[res1] + storageCell.storage.store[res1] < request.plan
            || this.lab2.store[res2] + storageCell.storage.store[res2] < request.plan) {
            request.plan = Math.min(this.lab1.store[res1] + storageCell.storage.store[res1], this.lab2.store[res2] + storageCell.storage.store[res2]);
            request.current = Math.min(request.plan, request.current);
          }

          if (this.lab1.store[res1] < amount && this.lab1.store.getFreeCapacity(res1) > LAB_MINERAL_CAPACITY / 10)
            storageCell.requestFromStorage(this.lab1.id + "_" + res1, [this.lab1], 3, undefined, res1);

          if (this.lab2.store[res2] < amount && this.lab2.store.getFreeCapacity(res2) > LAB_MINERAL_CAPACITY / 10)
            storageCell.requestFromStorage(this.lab2.id + "_" + res2, [this.lab2], 3, undefined, res2);


          if (request.plan - request.current > 1000) {
            this.fflush(request.resource, request.plan - request.current);
            request.plan -= request.current;
          } else if (request.current == 0) {
            this.fflush(request.resource);
            this.currentRequest = undefined;
            this.lab1 = undefined;
            this.lab2 = undefined;
          }
        }
      }

      if (!this.currentRequest) {
        this.currentRequest = this.synthesizeRequests.shift();
        if (this.currentRequest) {
          this.lab1 = this.getLabsFree(reactionMap[this.currentRequest.resource]!.res1, 0)[0];
          this.lab2 = this.getLabsFree(reactionMap[this.currentRequest.resource]!.res2, 0)[0];
          if (reactionMap[this.currentRequest.resource]!.res1 != res1)
            this.fflush(res1);
          if (reactionMap[this.currentRequest.resource]!.res2 != res2)
            this.fflush(res2);
        }
      }

      // bring to boost
      // TODO: boosting

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

  run() {
    if (this.currentRequest && this.currentRequest.current > 0) {
      if (this.lab1 && this.lab2) {
        let labs = this.getLabsFree(this.currentRequest.resource, 5);
        for (let k in _.filter(labs, (lab) => !lab.cooldown))
          if (labs[k].runReaction(this.lab1!, this.lab2!) == OK)
            this.currentRequest!.current -= 1;
        if (labs.length == 0)
          this.fflushAll();
      }
    }

    // here some boost logic
  }
}
