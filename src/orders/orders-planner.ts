import { makeId } from "static/utils";

import { FlagOrder } from "./order";

const PASSIVE_BUILD_COLORS: number[] = [COLOR_PURPLE, COLOR_RED, COLOR_BROWN];

export function actPlanner(order: FlagOrder) {
  if (!PASSIVE_BUILD_COLORS.includes(order.flag.secondaryColor))
    _.forEach(Apiary.orders, (o) => {
      if (
        o.color === COLOR_WHITE &&
        (order.secondaryColor !== COLOR_BLUE ||
          !PASSIVE_BUILD_COLORS.includes(o.secondaryColor)) &&
        o.ref !== order.ref
      )
        o.delete();
    });

  switch (order.secondaryColor) {
    case COLOR_BROWN: {
      const room = Game.rooms[order.pos.roomName];
      if (room && room.controller && room.controller.my) {
        _.forEach(room.find(FIND_HOSTILE_STRUCTURES), (s) => s.destroy());
        _.forEach(room.find(FIND_HOSTILE_CONSTRUCTION_SITES), (c) =>
          c.remove()
        );
      }
      order.delete();
      break;
    }
    case COLOR_BLUE: {
      let baseRotation: ExitConstant = BOTTOM;
      if (order.ref.includes("right")) baseRotation = RIGHT;
      else if (order.ref.includes("top")) baseRotation = TOP;
      else if (order.ref.includes("left")) baseRotation = LEFT;
      Apiary.planner.generatePlan(order.pos, baseRotation);
      break;
    }
    case COLOR_GREY:
      Apiary.planner.addUpgradeSite(order.hive.pos);
      break;
    case COLOR_ORANGE:
      if (
        Memory.cache.roomPlanner[order.pos.roomName] &&
        Object.keys(Memory.cache.roomPlanner[order.pos.roomName]).length
      ) {
        Apiary.planner.toActive(order.hive.pos, order.pos.roomName);
      } else order.delete();
      break;
    case COLOR_RED: {
      switch (order.ref) {
        case "all":
          Apiary.planner.currentToActive(order.pos.roomName, order.hive.pos);
          break;
        case "add":
          if (!Apiary.planner.activePlanning[order.pos.roomName])
            Apiary.planner.toActive(order.hive.pos, order.pos.roomName);
          Apiary.planner.addToPlan(
            order.pos,
            order.pos.roomName,
            undefined,
            true
          );
          _.forEach(order.pos.lookFor(LOOK_STRUCTURES), (s) => {
            if (s.structureType in CONTROLLER_STRUCTURES)
              Apiary.planner.addToPlan(
                order.pos,
                order.pos.roomName,
                s.structureType as BuildableStructureConstant,
                true
              );
          });
          _.forEach(order.pos.lookFor(LOOK_CONSTRUCTION_SITES), (s) => {
            if (s.structureType in CONTROLLER_STRUCTURES)
              Apiary.planner.addToPlan(
                order.pos,
                order.pos.roomName,
                s.structureType,
                true
              );
          });
          break;
        default: {
          if (!Apiary.planner.activePlanning[order.pos.roomName])
            Apiary.planner.toActive(order.hive.pos, order.pos.roomName);
          let sType = order.ref.split("_")[0];
          if (sType === "wall") sType = STRUCTURE_WALL;
          if (sType in CONTROLLER_STRUCTURES)
            Apiary.planner.addToPlan(
              order.pos,
              order.pos.roomName,
              sType as BuildableStructureConstant,
              true
            );
          else if (sType === "norampart") {
            const plan = Apiary.planner.activePlanning[order.pos.roomName].plan;
            if (plan[order.pos.x] && plan[order.pos.x][order.pos.y])
              plan[order.pos.x][order.pos.y].r = false;
          } else
            Apiary.planner.addToPlan(
              order.pos,
              order.pos.roomName,
              undefined,
              true
            );
        }
      }
      order.acted = false;
      break;
    }
    case COLOR_GREEN: {
      let del: 0 | 1 | 2 = 0;
      for (const name in Apiary.planner.activePlanning) {
        if (Apiary.planner.activePlanning[name].correct !== "ok") del = 1;
      }
      if (!del || /^force/.exec(order.ref)) {
        for (const name in Apiary.planner.activePlanning) {
          console.log(
            "SAVED: ",
            name,
            Apiary.planner.activePlanning[name].anchor
          );
          Apiary.planner.saveActive(name);
          delete Apiary.planner.activePlanning[name];
        }
        if (!Object.keys(Apiary.planner.activePlanning).length) del = 2;
      }
      if (order.pos.roomName in Game.rooms) {
        if (del > 1) {
          _.forEach(order.hive.cells.excavation.resourceCells, (cell) => {
            cell.roadTime = Infinity;
            cell.restTime = Infinity;
            cell.operational = false;
          });
          order.delete();
          order.pos.createFlag("OK_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
        } else if (del === 1)
          order.pos.createFlag("FAIL_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
      } else order.flag.setColor(COLOR_WHITE, COLOR_ORANGE);
      break;
    }
    case COLOR_PURPLE: {
      let planner = false;
      _.forEach(Game.flags, (f) => {
        if (
          f.color === COLOR_WHITE &&
          f.secondaryColor === COLOR_WHITE &&
          Apiary.orders[f.name] &&
          Game.time !== Apiary.createTime
        ) {
          Apiary.orders[f.name].acted = false;
          planner = true;
        }
      });
      if (!planner) Apiary.planner.addCustomRoad(order.hive.pos, order.pos);
      break;
    }
    case COLOR_YELLOW:
      Apiary.planner.addResourceRoads(order.hive.pos, true);
      Apiary.planner.addUpgradeSite(order.hive.pos);
      break;
  }
}

export function deletePlanner(order: FlagOrder) {
  if (
    !_.filter(Apiary.orders, (o) => {
      if (o.color !== COLOR_WHITE) return false;
      if (PASSIVE_BUILD_COLORS.includes(o.secondaryColor)) {
        if (order.secondaryColor !== COLOR_BLUE) o.flag.remove();
        return false;
      }
      return o.ref !== order.ref;
    }).length
  )
    for (const name in Apiary.planner.activePlanning)
      delete Apiary.planner.activePlanning[name];
}
