import { AnnoyOBot } from "beeMasters/squads/annoyOBot";
import { DismanleBoys } from "beeMasters/squads/dismatleBoys";
import { GangDuo } from "beeMasters/squads/gangDuo";
import { GangQuad } from "beeMasters/squads/quadSquad";
import { DowngradeMaster } from "beeMasters/war/downgrader";
import { HordeMaster } from "beeMasters/war/horde";
import { HordeDefenseMaster } from "beeMasters/war/hordeDefense";
import { WaiterMaster } from "beeMasters/war/waiter";
import { prefix } from "static/enums";

import { FlagOrder } from "./order";

export function actBattle(order: FlagOrder) {
  if (!order.master)
    switch (order.secondaryColor) {
      case COLOR_BLUE:
        order.master = new HordeDefenseMaster(order);
        break;
      case COLOR_RED:
        order.master = new HordeMaster(order);
        const regex = /^\d*/.exec(order.ref);
        if (regex && regex[0]) order.master.maxSpawns = +regex[0];
        break;
      case COLOR_PURPLE:
        order.master = new DowngradeMaster(order);
        break;
      case COLOR_GREEN:
        order.master = new WaiterMaster(order);
        break;
      case COLOR_ORANGE:
        order.master = new GangDuo(order);
        break;
      case COLOR_GREY:
        order.master = new GangQuad(order);
        break;
      case COLOR_YELLOW:
        order.master = new DismanleBoys(order);
        break;
      case COLOR_BROWN:
        order.master = new AnnoyOBot(order);
        break;
      case COLOR_WHITE:
        order.fixedName(prefix.surrender + order.hiveName);
        if (!order.flag.memory.info) order.flag.memory.info = Game.time;
        if (Game.time - order.flag.memory.info > CREEP_LIFE_TIME)
          order.delete();
        order.acted = false;
        break;
    }
}
