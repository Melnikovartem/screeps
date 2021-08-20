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
type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X";
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";

const REACTION_MAP: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[<ReactionConstant | BaseMineral>REACTIONS[res1][res2]] = {
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
  cooldown: number,
};

@profile
export class laboratoryCell extends Cell {
  laboratories: StructureLab[] = [];
  // inLab check for delivery system
  boostRequests: { [id: string]: { bee: Bee, amount: number, resource: ResourceConstant } } = {};
  labsStates: { [id: string]: "idle" | "waiting" | "boosting" | "production" | "fflush" | "source" } = {}
  synthesizeRequests: SynthesizeRequest[] = [];
  currentRequest?: SynthesizeRequest;
  lab1: StructureLab | undefined; // with res1
  lab2: StructureLab | undefined; // with res2

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  fllushProduction(res: ReactionConstant | BaseMineral): number {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      if (storageCell.requests[this.ref + "_" + res] && storageCell.requests[this.ref + "_" + res].to[0].id == storageCell.storage.id)
        return ERR_TIRED;
      let labs = _.filter(this.laboratories, (l) => this.labsStates[l.id] == "production"
        && l.store.getUsedCapacity(this.currentRequest!.res) > 0);

      if (labs.length) {
        storageCell.requests[this.ref + "_" + res] = {
          ref: this.ref + "_" + res,
          to: [storageCell.storage],
          from: labs,
          resource: res,
          priority: 3,
          multipleFrom: true,
        }

        _.forEach(labs, (l) => this.labsStates[l.id] = "fflush");
      }
      return ERR_NOT_FOUND;
    }
    return ERR_NOT_FOUND;
  }

  fflushLab(lab: StructureLab) {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      let res = lab.mineralType;
      if (!res)
        return OK;
      storageCell.requests[this.ref + "_" + res] = {
        ref: this.ref + "_" + res,
        to: [storageCell.storage],
        from: [lab],
        resource: res,
        priority: 3,
        multipleFrom: true,
      }
    }
    return ERR_NOT_FOUND;
  }

  rebalanceLabs() {
    _.forEach(this.laboratories, (l) => {
      if (l.store.getUsedCapacity() == 0 && this.labsStates[l.id] == "fflush")
        this.labsStates[l.id] = "idle";
      if ((this.labsStates[l.id] == "source" || this.labsStates[l.id] == "fflush") && !this.currentRequest)
        this.labsStates[l.id] = "idle";
    });
  }

  updateProductionLabs(resource: ReactionConstant) {
    _.forEach(this.laboratories, (l) => {
      if (this.labsStates[l.id] == "idle" && (!l.mineralType || l.mineralType == resource))
        this.labsStates[l.id] = "production";
    });
  }

  getBoostingLab(resource: ReactionConstant) {
    if (_.filter(this.laboratories, (l) => { this.labsStates[l.id] == "boosting" && l.store.getUsedCapacity(resource) >= 0 }))
      return OK;

    let ans: number = ERR_NOT_FOUND;
    _.some(this.laboratories, (l) => {
      if (this.labsStates[l.id] == "idle" && (!l.mineralType || l.mineralType == resource)) {
        this.labsStates[l.id] = "boosting";
        ans = OK;
        return true;
      }
      return false;
    });

    return ans;
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!Object.keys(REACTION_TIME).includes(resource))
      return 0;

    if (!amount) {
      amount = 0;
      let mainStore = this.hive.cells.storage && this.hive.cells.storage.storage.store;
      if (mainStore) {
        let res1 = REACTION_MAP[resource]!.res1;
        let res2 = REACTION_MAP[resource]!.res2;

        let res1Amount = mainStore[res1] + _.sum(this.laboratories, (lab) => lab.store[res1]);
        let res2Amount = mainStore[res2] + _.sum(this.laboratories, (lab) => lab.store[res2]);

        amount = Math.min(res1Amount, res2Amount);
      }
    }

    amount -= amount % 5;

    if (coef)
      amount *= coef;

    if (amount > 0)
      this.synthesizeRequests.push({
        plan: amount,
        current: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      });

    return amount;
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

        if (this.currentRequest.plan - this.currentRequest.current > LAB_MINERAL_CAPACITY / 2) {
          this.currentRequest.plan -= this.currentRequest.current;
          this.fllushProduction();
        } else if (this.currentRequest.current < 5) {
          this.fllushProduction(this.currentRequest.res);
          this.labsStates[this.lab1.id] = "fflush";
          this.currentRequest = undefined;
          this.lab1 = undefined;
          this.lab2 = undefined;
        }
      } else {
        if (!this.currentRequest)
          this.currentRequest = this.synthesizeRequests.shift();

        if (this.currentRequest && (!this.lab1 || !this.lab2)) {
          this.lab1 = _.filter(this.laboratories, (l) => this.labsStates[l.id] == "idle"
            && (l.store.getFreeCapacity() == 0 || l.store.getUsedCapacity(this.currentRequest!.res1)))[0];
          this.lab2 = _.filter(this.laboratories, (l) => this.labsStates[l.id] == "idle"
            && (l.store.getFreeCapacity() == 0 || l.store.getUsedCapacity(this.currentRequest!.res1)))[0];

          if (!this.lab1 || !this.lab2) {
            this.lab1 = undefined;
            this.lab2 = undefined;
          } else {
            this.updateProductionLabs();
          }
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
    if (this.currentRequest && Game.time % this.currentRequest.cooldown == 0 && this.currentRequest.current > 0) {
      if (this.lab1 && this.lab2)
        if (this.lab1.store[this.currentRequest.res1] >= 5 && this.lab2.store[this.currentRequest.res2] >= 5) {
          let labs = _.filter(this.laboratories, (lab) => !lab.cooldown &&
            this.boostingLabs.includes(lab.id) && lab.store.getFreeCapacity(this.currentRequest!.res) >= 5);
          for (const k in labs)
            if (labs[k].runReaction(this.lab1!, this.lab2!) == OK)
              this.currentRequest.current -= 5;
        } else {
          this.rebalanceLabs();
        }
    }

    // here some boost logic
  }
}
