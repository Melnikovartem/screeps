import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMasters/economy/manager";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  ref: string;
  from: StructureLink | StructureTerminal | StructureStorage | StructureLab;
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab;
  resource: ResourceConstant;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
}

const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.2);

@profile
export class storageCell extends Cell {

  storage: StructureStorage;
  links: { [id: string]: StructureLink } = {};
  linksState: { [id: string]: "idle" | "busy" } = {};
  terminal: StructureTerminal | undefined;
  master: managerMaster;

  requests: { [id: string]: StorageRequest } = {};

  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "StorageCell_" + hive.room.name);

    this.storage = storage;

    let links = <StructureLink[]>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_LINK);

    _.forEach(links, (l) => {
      this.links[l.id] = l;
      this.linksState[l.id] = "idle";
    });

    this.terminal = <StructureTerminal>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_TERMINAL)[0];

    this.pos = this.storage.pos;
    this.master = new managerMaster(this);
  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = 0): number {
    if (!amount || amount === Infinity)
      amount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(res);
    amount = Math.min(amount, this.storage.store.getUsedCapacity(res));
    if (amount > 0)
      this.requests[ref] = {
        ref: ref,
        from: this.storage,
        to: to,
        resource: res,
        priority: priority,
        amount: amount,
      };
    return amount;
  }

  requestToStorage(ref: string, from: StorageRequest["from"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = 0): number {

    if (from.structureType == STRUCTURE_LAB && from.mineralType)
      res = from.mineralType;
    if (!amount || amount === Infinity)
      amount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(res);
    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    if (amount > 0)
      this.requests[ref] = {
        ref: ref,
        from: from,
        to: this.storage,
        resource: res,
        priority: priority,
        amount: amount,
      };
    return amount;
  }

  getFreeLink(sendIn: boolean = false): StructureLink | undefined {
    return _.filter(this.links, (l) => !sendIn || this.linksState[l.id] == "idle").sort(
      (a, b) => (b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)) * (sendIn ? -1 : 1))[0];
  }

  update() {
    super.update(["links"]);

    for (let k in this.requests) {
      let from = <StorageRequest["from"] | null>Game.getObjectById(this.requests[k].from.id);
      if (from)
        this.requests[k].from = from;
      let to = <StorageRequest["to"] | null>Game.getObjectById(this.requests[k].to.id);
      if (to)
        this.requests[k].to = to;
    }

    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 1000)
      this.storage.pos.createFlag("boost_" + this.hive.roomName, COLOR_PURPLE, COLOR_WHITE);

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5 && !this.requests[link.id])
        this.requestToStorage("link_" + link.id, link, 4);
    }

    if (!Object.keys(this.requests).length && this.terminal) {
      let res: ResourceConstant = RESOURCE_ENERGY;
      let amount = this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) - TERMINAL_ENERGY;

      for (let resourceConstant in this.terminal.store) {
        let resource = <ResourceConstant>resourceConstant;
        let newAmount = this.terminal.store.getUsedCapacity(resource);
        if (res === RESOURCE_ENERGY)
          newAmount -= TERMINAL_ENERGY;
        if (Math.abs(newAmount) > amount) {
          res = resource;
          amount = newAmount;
        }
      }

      if (amount > 0)
        this.requestToStorage("terminal_" + this.terminal.id, this.terminal, 5, res, Math.min(amount, 9900));
      else if (amount < 0)
        this.requestFromStorage("terminal_" + this.terminal.id, this.terminal, 5, res, Math.min(-amount, 9900));
    }
  }

  run() {
    for (let k in this.requests) {
      let request = this.requests[k];
      if (request.amount > 0 && !request.from.store[request.resource]
        && !(this.master.manager && this.master.manager.store[request.resource]))
        delete this.requests[k];
      if ((<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource))
        delete this.requests[k];
      if (request.amount <= 0) {
        console.log(this.requests[k].ref, this.requests[k].amount)
        delete this.requests[k];
      }
    }
  }
}
