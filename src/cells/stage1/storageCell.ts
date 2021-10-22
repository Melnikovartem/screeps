import { Cell } from "../_Cell";
import { ManagerMaster } from "../../beeMasters/economy/manager";
import { TransferRequest } from "../../bees/transferRequest";

import { prefix } from "../../enums";
import { BASE_MINERALS } from "./laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class StorageCell extends Cell {

  storage: StructureStorage;
  links: { [id: string]: StructureLink } = {};
  linksState: { [id: string]: "idle" | "busy" } = {};
  terminal: StructureTerminal | undefined;
  master: ManagerMaster;

  requests: { [id: string]: TransferRequest } = {};
  resTargetTerminal: { [key in ResourceConstant]?: number } = {};

  usedCapacity: { [key in ResourceConstant]?: number } = {}

  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, prefix.storageCell + hive.room.name);

    this.storage = storage;
    this.terminal = this.hive.room.terminal;

    let links = <StructureLink[]>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      structure => structure.structureType === STRUCTURE_LINK);

    _.forEach(links, l => {
      this.links[l.id] = l;
      this.linksState[l.id] = "idle";
    });

    this.pos = storage.pos;
    this.master = new ManagerMaster(this);
  }

  requestFromStorage(objects: TransferRequest["to"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;
    amount = Math.min(amount, this.storage.store.getUsedCapacity(res));
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].structureType + "_" + objects[i].id;
      if (this.requests[ref] && this.requests[ref].priority === priority && this.requests[ref].to.id === objects[i].id)
        continue;
      let amountCC = amount;
      if (fitStore)
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>objects[i].store).getFreeCapacity(res));
      if (amountCC <= 0)
        continue;
      this.requests[ref] = new TransferRequest(ref, this.storage, objects[i], priority, res, amountCC);
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  requestToStorage(objects: TransferRequest["from"][], priority: TransferRequest["priority"]
    , res: TransferRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity, fitStore = false): number {
    let sum = 0;
    let prev: TransferRequest | undefined;

    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    for (let i = 0; i < objects.length; ++i) {
      let ref = objects[i].id;
      if (this.requests[ref] && this.requests[ref].priority === priority && this.requests[ref].from.id === objects[i].id)
        continue;
      let amountCC = amount;
      if (fitStore && !(objects[i] instanceof Resource))
        amountCC = Math.min(amountCC, (<Store<ResourceConstant, false>>(<Exclude<TransferRequest["from"], Resource>>objects[i]).store).getUsedCapacity(res));
      if (amountCC <= 0)
        continue;
      this.requests[ref] = new TransferRequest(ref, objects[i], this.storage, priority, res, amountCC);
      if (prev)
        this.requests[ref].nextup = prev;
      prev = this.requests[ref];
      sum += this.requests[ref].amount;
    }
    return sum;
  }

  getFreeLink(sendIn: boolean = false): StructureLink | undefined {
    let links = _.filter(this.links, l => !sendIn || this.linksState[l.id] === "idle").sort(
      (a, b) => (b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)) * (sendIn ? -1 : 1));
    if (sendIn || !links.length)
      return links[0];
    else
      return links.reduce((prev, curr) => curr.cooldown < prev.cooldown ? curr : prev);
  }

  update() {
    super.update(["links"]);

    this.usedCapacity = {};

    if (!this.storage) {
      Apiary.destroyTime = Game.time;
      return;
    }

    for (let k in this.requests)
      this.requests[k].update();

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5)
        this.requestToStorage([link], 3);
    }

    this.hive.stateChange("lowenergy", this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 10000);
    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 8000 && !this.hive.cells.dev)
      Apiary.destroyTime = Game.time;

    //if (!Object.keys(this.requests).length)
    this.updateTerminal();
  }

  updateTerminal() {
    if (!this.terminal)
      return;
    for (let r in this.terminal.store) {
      let res = <ResourceConstant>r;
      if (!this.resTargetTerminal[res])
        if (this.requestToStorage([this.terminal], 5, res, this.terminal.store.getUsedCapacity(res)) > 0)
          return;
      delete this.requests[this.terminal.id];
    }

    for (let r in this.resTargetTerminal) {
      let res = <ResourceConstant>r;
      let balance = this.terminal.store.getUsedCapacity(res) - this.resTargetTerminal[res]!;
      if (balance < 0) {
        console.log(res, balance, this.hive.print)
        if (this.requestFromStorage([this.terminal], 5, res, -balance) > 0)
          return;
      } else if (balance > 0) {
        if (this.requestToStorage([this.terminal], 5, res, balance) > 0)
          return;
      }
    }
  }

  run() {
    for (let k in this.requests)
      if (!this.requests[k].isValid())
        delete this.requests[k];
  }

  getUsedCapacity(resource: ResourceConstant) {
    if (this.usedCapacity[resource])
      return this.usedCapacity[resource]!;
    let amount = this.storage.store.getUsedCapacity(resource);
    if (this.terminal) {
      let toAdd = this.terminal.store.getUsedCapacity(resource);
      if (resource && resource in this.resTargetTerminal)
        toAdd = Math.max(0, toAdd - this.resTargetTerminal[resource]!);
      amount += toAdd;
    }

    _.forEach(this.master.activeBees, bee => {
      amount += bee.store.getUsedCapacity(resource);
    });

    if ((BASE_MINERALS.includes(resource) || resource in REACTION_TIME) && this.hive.cells.lab)
      _.forEach(this.hive.cells.lab.laboratories, lab => {
        let toAdd = lab.store.getUsedCapacity(resource);
        if (toAdd)
          amount += toAdd;
      });
    this.usedCapacity[resource] = amount;
    return amount;
  }
}
