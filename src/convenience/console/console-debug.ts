import type { Master } from "beeMasters/_Master";
import { TransferRequest } from "bees/transferRequest";
import { prefix } from "static/enums";

import { CustomConsole } from "./console";

declare module "./console" {
  export interface CustomConsole {
    printSpawnOrders: (hiveName?: string) => string;
    printStorageOrders: (hiveName?: string) => string;
    printHives: () => string;
    printByHive: (
      obj: { print: string; hive: { roomName: string } }[]
    ) => string;
    printByMasters: (
      obj: {
        print: string;
        master?: { ref: string };
      }[]
    ) => string;
    printMasters: (ref?: string) => string;
    printOrders: (ref?: string) => string;
    printBees: (ref?: string, byHives?: boolean) => string;
  }
}

CustomConsole.prototype.printSpawnOrders = function (hiveName) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  return _.map(
    _.filter(Apiary.hives, (h) => !hiveName || h.roomName === hiveName),
    (h) =>
      `${h.print}: \n${_.map(
        _.map(h.spawOrders, (order, master) => {
          return { order, master: master! };
        }).sort((a, b) => a.order.priority - b.order.priority),
        (o) => `${o.order.priority} ${o.master}: ${o.order.setup.name}`
      ).join("\n")} \n`
  ).join("\n");
};

CustomConsole.prototype.printStorageOrders = function (hiveName) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  return _.map(
    _.filter(Apiary.hives, (h) => !hiveName || h.roomName === hiveName),
    (h) => {
      if (!h.cells.storage) return "";
      return `${h.print}: \n${_.map(
        _.map(h.cells.storage.requests).sort(
          (a, b) =>
            (a as TransferRequest).priority - (b as TransferRequest).priority
        ),
        (o: TransferRequest) =>
          `${o.isValid() ? "" : "-"} ${o.priority} ${o.ref}: ${
            o.from instanceof Structure ? o.from.structureType : o.from
          } -> ${o.resource}${
            o.amount !== Infinity ? ": " + o.amount : ""
          } -> ${o.to.structureType}${o.nextup ? " -> " + o.nextup.ref : ""}`
      ).join("\n")} \n`;
    }
  ).join("\n");
};

CustomConsole.prototype.printHives = () =>
  _.map(Apiary.hives, (o) => o.print).join("\n");

CustomConsole.prototype.printByHive = function (
  obj: { print: string; hive: { roomName: string } }[]
) {
  return _.compact(
    _.map(Apiary.hives, (h) => {
      const objHive = _.map(
        _.filter(obj, (o) => o.hive.roomName === h.roomName),
        (o) => o.print
      );
      if (!objHive.length) return;
      return `${h.print}:\n${objHive.join("\n")}\n----------`;
    })
  ).join("\n");
};

CustomConsole.prototype.printByMasters = function (
  obj: {
    print: string;
    master?: { ref: string };
  }[]
) {
  return _.compact(
    (_.map(Apiary.masters).concat([undefined]) as (Master | undefined)[]).map(
      (m) => {
        const objHive = _.map(
          _.filter(
            obj,
            (o) =>
              (!m && !o.master) || (m && o.master && o.master.ref === m.ref)
          ),
          (o) => o.print
        );
        if (!objHive.length) return;
        return `${m ? m.print : "None"}:\n${objHive.join("\n")}\n----------`;
      }
    )
  ).join("\n");
};

CustomConsole.prototype.printMasters = function (ref?: string) {
  const obj = _.filter(
    Apiary.masters,
    (m) => !ref || m.hive.roomName === ref || m.ref.includes(ref)
  );
  return this.printByHive(obj);
};

CustomConsole.prototype.printOrders = function (ref?: string) {
  const extraFilter = (rr: string) =>
    !rr.includes(prefix.annex) &&
    !rr.includes(prefix.mine) &&
    !rr.includes(prefix.puppet);
  const obj = _.filter(
    Apiary.orders,
    (o) =>
      (!ref || o.hive.roomName === ref || o.ref.includes(ref)) &&
      extraFilter(o.ref)
  );
  return this.printByHive(obj);
};

CustomConsole.prototype.printBees = function (
  ref?: string,
  byHives: boolean = false
) {
  const bees = _.filter(
    Apiary.bees,
    (b) =>
      !ref ||
      ("refMaster" in b.creep.memory && b.creep.memory.refMaster.includes(ref))
  );
  let obj;
  if (byHives) {
    obj = _.map(bees, (b) => {
      return {
        print: b.print,
        hive: { roomName: b.master ? b.master.hive.roomName : "none" },
      };
    });
    return this.printByHive(obj);
  }
  obj = _.map(bees, (b) => {
    return { print: b.print, master: b.master };
  });
  return this.printByMasters(obj);
};
