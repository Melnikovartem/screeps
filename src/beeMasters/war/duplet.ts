import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { Bee } from "../../bees/bee";
import type { SpawnOrder } from "../../Hive";
import { states } from "../_Master";
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dupletMaster extends SwarmMaster {
  healer: Bee | undefined;
  knight: Bee | undefined;
  maxSpawns = 1;

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL))
      this.healer = bee;
    else
      this.knight = bee;
  }

  update() {
    super.update();

    if (this.knight && !Apiary.bees[this.knight.ref])
      delete this.knight;

    if (this.healer && !Apiary.bees[this.healer.ref])
      delete this.healer;

    if (this.checkBeesSwarm()) {
      if (!this.knight) {
        let knightOrder: SpawnOrder = {
          setup: Setups.defender,
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        knightOrder.setup.patternLimit = 10;
        this.wish(knightOrder, this.ref + "_knight");
      }
      if (!this.healer) {
        let healerOrder: SpawnOrder = {
          setup: Setups.healer,
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        healerOrder.setup.patternLimit = 2;
        this.wish(healerOrder, this.ref + "_healer");
      }
      _.forEach(this.bees, (bee) => bee.state = states.refill);
    }
  }

  run() {
    let knight = this.knight;
    let healer = this.healer;
    _.forEach(this.bees, (bee) => {
      if (bee.state === states.refill)
        bee.goRest(this.hive.pos);
    });

    if (knight && healer) {
      knight.state = states.work;
      healer.state = states.work;
    }

    _.forEach(this.bees, (bee) => {
      // if reconstructed while they all spawned, but not met yet or one was lost
      if (bee.state === states.chill)
        bee.state = states.work;
    });

    if (knight && knight.state === states.work) {
      let roomInfo = Apiary.intel.getInfo(knight.pos.roomName);
      let target: Structure | Creep = <Structure | Creep>knight.pos.findClosest(_.filter(roomInfo.enemies,
        (e) => (e.pos.getRangeTo(knight!) < 4 || (knight!.pos.roomName === this.order.pos.roomName)
          && !(e instanceof Creep && e.owner.username === "Source Keeper"))));
      let ans;
      if (target)
        ans = knight.attack(target);
      else if (knight.hits === knight.hitsMax)
        ans = knight.goRest(this.order.pos);

      if (healer) {
        if (healer.pos.isNearTo(knight.pos) && ans === ERR_NOT_IN_RANGE)
          healer.creep.move(healer.pos.getDirectionTo(knight.pos));
        else if (!healer.pos.isNearTo(knight.pos))
          healer.goTo(knight.pos);
      }
    }

    if (healer && healer.state === states.work) {
      if (healer.hits < healer.hitsMax) {
        healer.heal(healer);
      } if (knight && knight.hits < knight.hitsMax) {
        if (healer.pos.isNearTo(knight))
          healer.heal(knight);
        else
          healer.rangedHeal(knight);
      } else {
        let healingTarget = healer.pos.findClosest(_.filter(healer.pos.findInRange(FIND_MY_CREEPS, knight ? 3 : 10),
          (bee) => bee.hits < bee.hitsMax));
        if (healingTarget) {
          if (healer.pos.isNearTo(healingTarget))
            healer.heal(healingTarget);
          else
            healer.rangedHeal(healingTarget);
        } else if (!knight)
          healer.goTo(this.order.pos);
      }
    }
  }
}
