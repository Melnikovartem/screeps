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

    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 1000)
      this.storage.pos.createFlag("boost_" + this.hive.roomName, COLOR_PURPLE, COLOR_WHITE);

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5 && !this.requests[link.id])
        this.requestToStorage("link_" + link.id, link, 4);
    }
  }

  run() { }
}
