import { AnnexMaster } from "beeMasters/civil/annexer";
import { ClaimerMaster } from "beeMasters/civil/claimer";
import { PuppetMaster } from "beeMasters/civil/puppet";
import { SKMaster } from "beeMasters/war/safeSK";
import { hiveStates, prefix, roomStates } from "static/enums";

import { FlagOrder } from "./order";

export function actAnnex(order: FlagOrder) {
  switch (order.secondaryColor) {
    case COLOR_PURPLE:
      if (order.pos.getRoomRangeTo(order.hive, "path") >= 6) {
        order.delete();
        break;
      }

      if (!(order.pos.roomName in Game.rooms)) {
        Apiary.requestSight(order.pos.roomName);
        if (
          !order.hive.cells.observe &&
          !order.master &&
          !Game.flags[prefix.puppet + order.pos.roomName]
        ) {
          order.master = new PuppetMaster(order);
          order.master.maxSpawns = Infinity; // order.master.spawned + 1;
        }
        order.acted = false;
        break;
      }

      if (order.master instanceof PuppetMaster) {
        let nonClaim = order.master.beesAmount;
        _.forEach(order.master.bees, (b) =>
          !b.getBodyParts(CLAIM)
            ? (b.creep.memory.refMaster =
                prefix.master +
                prefix.swarm +
                prefix.puppet +
                order.pos.roomName)
            : --nonClaim
        );
        if (nonClaim) {
          const ans = order.pos.createFlag(
            prefix.puppet + order.pos.roomName,
            COLOR_GREY,
            COLOR_PURPLE
          );
          if (typeof ans === "string")
            Game.flags[ans].memory = {
              hive: order.hiveName,
              info: order.master.spawned,
            };
        }
        order.master.delete();
        order.master = undefined;
      }

      if (!order.fixedName(prefix.annex + order.pos.roomName)) break;

      if (!order.master) {
        const roomState = Apiary.intel.getInfo(
          order.pos.roomName,
          Infinity
        ).roomState;
        switch (roomState) {
          case roomStates.ownedByMe:
            if (
              Apiary.hives[order.pos.roomName] &&
              Apiary.hives[order.pos.roomName].phase > 0
            )
              order.delete();
            else order.hive.addAnex(order.pos.roomName);
            break;
          case roomStates.reservedByEnemy:
          case roomStates.reservedByInvader:
          case roomStates.noOwner:
          case roomStates.reservedByMe:
            order.hive.addAnex(order.pos.roomName);
            if (order.hive.room.energyCapacityAvailable < 650) {
              order.master = new PuppetMaster(order);
              order.master.maxSpawns = Infinity;
            } else order.master = new AnnexMaster(order);
            break;
          case roomStates.SKfrontier:
            if (
              order.hive.room.energyCapacityAvailable >= 5500 &&
              !order.hive.bassboost
            ) {
              order.master = new SKMaster(order);
              order.hive.addAnex(order.pos.roomName);
            }
            break;
          case roomStates.SKcentral:
            if (
              order.hive.room.energyCapacityAvailable >= 5500 &&
              !order.hive.bassboost
            )
              order.hive.addAnex(order.pos.roomName);
            order.master = new PuppetMaster(order);
            order.master.maxSpawns = Infinity;
            break;
          default:
            order.delete();
        }
      }
      break;
    case COLOR_GREY:
      if (Object.keys(Apiary.hives).length < Game.gcl.level) {
        if (!order.master) order.master = new ClaimerMaster(order);
      } else order.acted = false;
      break;
    case COLOR_WHITE: {
      order.acted = false;
      const hiveToBoos = Apiary.hives[order.pos.roomName];
      if (!hiveToBoos || order.pos.roomName === order.hiveName) {
        order.delete();
        break;
      }

      if (!order.fixedName(prefix.boost + order.pos.roomName)) break;

      if (order.hive.state !== hiveStates.economy) {
        hiveToBoos.bassboost = null;
        break;
      }

      if (hiveToBoos.bassboost) {
        if (order.hive.phase > 0 && hiveToBoos.state === hiveStates.economy)
          order.delete();
        break;
      }

      hiveToBoos.bassboost = order.hive;
      hiveToBoos.spawOrders = {};
      _.forEach(Apiary.masters, (c) => {
        if (c.hive.roomName === order.pos.roomName) c.waitingForBees = 0;
      });
      if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.master)
        hiveToBoos.cells.dev.master.recalculateTargetBee();
      break;
    }
  }
}

export function deleteAnnex(order: FlagOrder) {
  switch (order.secondaryColor) {
    case COLOR_WHITE: {
      const hiveBoosted = Apiary.hives[order.pos.roomName];
      if (hiveBoosted) {
        hiveBoosted.bassboost = null;
        if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.master)
          hiveBoosted.cells.dev.master.recalculateTargetBee();
      }
      break;
    }
    case COLOR_PURPLE: {
      const index = order.hive.annexNames.indexOf(order.pos.roomName);
      if (index !== -1) order.hive.annexNames.splice(index, 1);
      if (!Apiary.hives[order.pos.roomName])
        _.forEach(
          _.filter(
            Game.flags,
            (f) =>
              f.color === COLOR_YELLOW && f.pos.roomName === order.pos.roomName
          ),
          (f) => f.remove()
        );
      for (const ref in order.hive.cells.excavation.resourceCells)
        if (
          order.hive.cells.excavation.resourceCells[ref].pos.roomName ===
          order.pos.roomName
        ) {
          order.hive.cells.excavation.resourceCells[ref].master.delete();
          delete order.hive.cells.excavation.resourceCells[ref];
        }
      break;
    }
  }
}
