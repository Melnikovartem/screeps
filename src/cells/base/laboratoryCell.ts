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
type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X"
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";

const reactionMap: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
for (let res1 in REACTIONS) {
  for (let res2 in REACTIONS[res1])
    reactionMap[<ReactionConstant | BaseMineral>REACTIONS[res1][res2]] = {
      res1: <ReactionConstant | BaseMineral>res1,
      res2: <ReactionConstant | BaseMineral>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  plan: number,
  current: number,
  res: ReactionConstant,
  res1: ReactionConstant | BaseMineral,
  res2: ReactionConstant | BaseMineral,
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
  cycle: number = 1;

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  getLabsFree(resource: ReactionConstant | BaseMineral, amount?: number, sorted?: boolean): StructureLab[] {
    let labs = _.filter(this.laboratories, (lab) =>
      lab.store.getFreeCapacity(resource) >= (amount != undefined ? amount : 1)
      && (!lab.mineralType || lab.mineralType == resource)
      && (!this.lab1 || lab.id != this.lab1.id)
      && (!this.lab2 || lab.id != this.lab2.id));
    if (sorted)
      labs.sort((a, b) => b.store.getUsedCapacity(resource) - a.store.getUsedCapacity(resource));
    return labs;
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!Object.keys(REACTION_TIME).includes(resource))
      return ERR_INVALID_ARGS;

    if (!amount) {
      amount = 0;
      let mainStore = this.hive.cells.storage && this.hive.cells.storage.storage.store;
      if (mainStore) {
        let res1 = reactionMap[resource]!.res1;
        let res2 = reactionMap[resource]!.res2;

        let res1Amount = mainStore[res1] + _.sum(this.laboratories, (lab) => lab.store[res1]);
        let res2Amount = mainStore[res2] + _.sum(this.laboratories, (lab) => lab.store[res2]);

        amount = Math.min(res1Amount, res2Amount);
      }
    }

    amount -= amount % 5;

    if (coef)
      amount *= coef;
    this.synthesizeRequests.push({
      plan: amount,
      current: amount,
      res: resource,
      res1: reactionMap[resource]!.res1,
      res2: reactionMap[resource]!.res2,
    });

    return amount;
  }

  fflush(res: ReactionConstant | BaseMineral, amount?: number): number {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (storageCell.requests[this.ref + "_" + res] && storageCell.requests[this.ref + "_" + res].to[0].id == storageCell.storage.id)
        return ERR_TIRED;
      let sum = 0;
      let labs: StructureLab[] = [];
      amount = amount ? amount : Infinity;
      _.some(this.laboratories, (lab) => {
        if (lab.mineralType == res) {
          sum += Math.min(lab.store.getUsedCapacity(res), amount! - sum);
          labs.push(lab);
        }
        return sum == amount;
      });
      if (labs.length) {
        storageCell.requests[this.ref + "_" + res] = {
          ref: this.ref + "_" + res,
          to: [storageCell.storage],
          from: labs,
          resource: res,
          priority: 3,
          amount: sum,
          multipleFrom: true,
        }
        return sum;
      }
      return ERR_NOT_FOUND;
    }
    return ERR_NOT_FOUND;
  }

  fflushAll() {
    let resources: (ReactionConstant | BaseMineral)[] = [];
    _.forEach(this.laboratories, (lab) => {
      if (lab.mineralType && !resources.includes(lab.mineralType) && (!this.currentRequest
        || (this.currentRequest.res1 != lab.mineralType && this.currentRequest.res2 != lab.mineralType)))
        resources.push(lab.mineralType);
    });
    _.forEach(resources, (res) => {
      this.fflush(res);
    });
  }

  update() {
    super.update();
    let storageCell = this.hive.cells.storage;
    if (storageCell && this.laboratories.length) {
      if (this.currentRequest && this.lab1 && this.lab2) {
        let res1 = this.currentRequest.res1;
        let res2 = this.currentRequest.res2;

        if (this.lab1.store[res1] < this.currentRequest.current && this.lab1.store.getFreeCapacity(res1) > LAB_MINERAL_CAPACITY / 10)
          storageCell.requestFromStorage(this.lab1.id + "_" + res1, [this.lab1], 3, undefined, res1);

        if (this.lab2.store[res2] < this.currentRequest.current && this.lab2.store.getFreeCapacity(res2) > LAB_MINERAL_CAPACITY / 10)
          storageCell.requestFromStorage(this.lab2.id + "_" + res2, [this.lab2], 3, undefined, res2);

        if (this.currentRequest.plan - this.currentRequest.current > 300) {
          this.fflush(this.currentRequest.res);
          this.currentRequest.plan -= this.currentRequest.current;
        } else if (this.currentRequest.current == 0) {
          this.currentRequest = undefined;
          this.lab1 = undefined;
          this.lab2 = undefined;
          this.fflushAll();
        }
      } else {
        if (!this.currentRequest)
          this.currentRequest = this.synthesizeRequests.shift();

        if (this.currentRequest && (!this.lab1 || !this.lab2)) {
          this.cycle = 1;
          this.lab1 = this.getLabsFree(this.currentRequest.res1, 0, true)[0];
          this.lab2 = this.getLabsFree(this.currentRequest.res2, 0, true)[0];
          if (!this.lab1 || !this.lab2) {
            this.lab1 = undefined;
            this.lab2 = undefined;
          }
          this.fflushAll();
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
    if (this.currentRequest && this.currentRequest.current > 0 && Game.time % this.cycle == 0) {
      if (this.lab1 && this.lab1.store[this.currentRequest.res1] > 5
        && this.lab2 && this.lab2.store[this.currentRequest.res2] > 5) {
        if (this.cycle == 1)
          this.cycle = REACTION_TIME[this.currentRequest.res];

        let labs = this.getLabsFree(this.currentRequest.res, 5);
        for (let k in _.filter(labs, (lab) => !lab.cooldown))
          if (labs[k].runReaction(this.lab1!, this.lab2!) == OK)
            this.currentRequest.current -= 5;
        if (labs.length == 0)
          this.fflushAll();
      }
    } else if (this.currentRequest && this.lab1 && this.lab2) {
      let storageCell = this.hive.cells.storage;
      if (storageCell && this.laboratories.length) {
        // red button for request
        let res1Amount = this.lab1.store[this.currentRequest.res1] + storageCell.storage.store[this.currentRequest.res1];
        let res2Amount = this.lab2.store[this.currentRequest.res2] + storageCell.storage.store[this.currentRequest.res2];
        if (res1Amount == 0 || res2Amount == 0) {
          res1Amount += _.sum(this.hive.room.find(FIND_MY_CREEPS), (c) => c.store[this.currentRequest!.res1]);
          res2Amount += _.sum(this.hive.room.find(FIND_MY_CREEPS), (c) => c.store[this.currentRequest!.res2]);
          if (res1Amount == 0 || res2Amount == 0) {
            this.currentRequest.plan = 0;
            this.currentRequest.current = 0;
          }
        }
      }
    }

    // here some boost logic
  }
}
