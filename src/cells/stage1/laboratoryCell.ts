// import { Bee } from "../../bee";
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
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  boostRequests: { [id: string]: { amount: number, resource: ResourceConstant } } = {};
  labsStates: { [id: string]: "idle" | "waiting" | "boosting" | "production" | "fflush" | "source" } = {}
  synthesizeRequests: SynthesizeRequest[] = [];
  currentRequest?: SynthesizeRequest;
  sourceLabs: [string, string] | undefined;

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  fflushLab(lab: StructureLab) {
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      let res = lab.mineralType;
      if (!res)
        return OK;
      storageCell.requestToStorage(this.ref + "_" + res, [lab], 3);
      this.labsStates[lab.id] = "fflush";
    }
    return ERR_NOT_FOUND;
  }

  updateProductionLabs(): StructureLab[] {
    if (this.currentRequest) {
      let ans: StructureLab[] = [];
      _.forEach(this.laboratories, (l) => {
        if (this.labsStates[l.id] == "idle" && (!l.mineralType || l.mineralType == this.currentRequest!.res)) {
          this.labsStates[l.id] = "production";
          ans.push(l);
        }
      });
      return ans;
    }
    return [];
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

        let res1Amount = mainStore.getUsedCapacity(res1) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res1));
        let res2Amount = mainStore.getUsedCapacity(res2) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res2));

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
    super.update(["laboratories"]);
    let storageCell = this.hive.cells.storage;
    if (storageCell && Object.keys(this.laboratories).length) {
      _.forEach(this.laboratories, (l) => {
        if (!this.labsStates[l.id])
          this.labsStates[l.id] = "idle";
        if (l.store.getUsedCapacity() == 0 && this.labsStates[l.id] == "fflush")
          this.labsStates[l.id] = "idle";
        if (this.labsStates[l.id] == "source")
          if (!this.currentRequest)
            if (this.labsStates[l.id] == "source")
              if (!this.currentRequest)
                this.labsStates[l.id] = "fflush";
        if (this.labsStates[l.id] == "boosting")
          // producing and dont need the boost
          if (!this.currentRequest && ((!l.mineralType && Object.keys(this.boostRequests).length == 0)
            || (l.mineralType && this.boostRequests[l.mineralType].amount == 0)))
            this.labsStates[l.id] = "fflush";
      });

      if (this.currentRequest && this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        let res1 = this.currentRequest.res1;
        let res2 = this.currentRequest.res2;

        if (lab1.store.getUsedCapacity(res1) < this.currentRequest.current && lab1.store.getFreeCapacity(res1) > LAB_MINERAL_CAPACITY / 10)
          storageCell.requestFromStorage(lab1.id + "_" + res1, [lab1], 3, [res1]);

        if (lab2.store.getUsedCapacity(res2) < this.currentRequest.current && lab2.store.getFreeCapacity(res2) > LAB_MINERAL_CAPACITY / 10)
          storageCell.requestFromStorage(lab2.id + "_" + res2, [lab2], 3, [res2]);

        if (this.currentRequest.plan - this.currentRequest.current > LAB_MINERAL_CAPACITY / 2) {
          this.currentRequest.plan -= this.currentRequest.current;
          // this.fllushProduction(this.currentRequest.res);
        } else if (this.currentRequest.current < 5) {
          //this.fllushProduction(this.currentRequest.res);
          this.fflushLab(lab1);
          this.fflushLab(lab2);
          this.currentRequest = undefined;
          this.sourceLabs = undefined;
        }
      } else {
        if (!this.currentRequest)
          this.currentRequest = this.synthesizeRequests.shift();

        if (!this.sourceLabs && this.currentRequest) {
          let lab1 = _.filter(this.laboratories, (l) => this.labsStates[l.id] == "idle"
            && (l.store.getFreeCapacity() == 0 || l.store.getUsedCapacity(this.currentRequest!.res1)))[0];
          let lab2;
          if (lab1)
            lab2 = _.filter(this.laboratories, (l) => this.labsStates[l.id] == "idle"
              && (l.store.getFreeCapacity() == 0 || l.store.getUsedCapacity(this.currentRequest!.res1))
              && l.id != lab1.id)[0];

          if (lab1 && lab2) {
            this.updateProductionLabs();
            this.labsStates[lab1.id] = "source";
            this.labsStates[lab2.id] = "source";
            this.sourceLabs = [lab1.id, lab2.id];
          }
        }

        // bring to boost

        _.forEach(this.laboratories, (lab) => {
          if (lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 4)
            storageCell!.requestFromStorage(lab.id, [lab], lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 2 ? 2 : 5);
        });
      }
    }
  }

  run() {
    if (this.currentRequest && Game.time % this.currentRequest.cooldown == 0 && this.currentRequest.current > 0) {
      if (this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        if (lab1.store[this.currentRequest.res1] >= 5 && lab2.store[this.currentRequest.res2] >= 5) {
          let labs = _.filter(this.laboratories, (lab) => !lab.cooldown &&
            this.labsStates[lab.id] == "production" && lab.store.getFreeCapacity(this.currentRequest!.res) >= 5);
          if (labs.length == 0)
            labs = this.updateProductionLabs();
          for (const k in labs)
            if (labs[k].runReaction(lab1, lab2) == OK)
              this.currentRequest.current -= 5;
        }
      }
    }

    // here some boost logic
  }
}
