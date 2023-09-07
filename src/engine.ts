/** return function and it's activation time */
export type FnEngine = () => void | { f: FnEngine; ac?: number };

interface Task {
  // #region Properties (3)

  func: FnEngine;
  ref: string;
  timeInit: number;
  timeAct: number;

  // #endregion Properties (3)
}

/** what cpu to save based on bucket */
const CPU_ENGINE = {
  0: 100,
  1000: 10,
  9000: 0,
};

/** engine for recalc of heavy operations */
export class Engine {
  // #region Properties (1)

  private que: Task[] = [];

  // #endregion Properties (1)

  // #region Private Accessors (1)

  private get canRun() {
    let cpuToSave = CPU_ENGINE[0];
    _.forEach(CPU_ENGINE, (cpuToSaveIter, thrshBucket) => {
      // bucket is too small so we dont save it
      if (Game.cpu.bucket < +thrshBucket!) return;
      // the new metric is better
      cpuToSave = Math.min(cpuToSave, cpuToSaveIter);
    });
    return Game.cpu.limit - Game.cpu.getUsed() > cpuToSave;
  }

  // #endregion Private Accessors (1)

  // #region Public Methods (3)

  public addTask(
    ref: string,
    func: FnEngine,
    timeAct = Game.time,
    timeInit = Game.time
  ) {
    this.que.push({
      ref,
      func,
      timeInit,
      timeAct,
    });
  }

  public run() {
    for (let i = 0; i < this.que.length && this.canRun; ++i) {
      const task = this.que[i];
      if (task.timeAct > Game.time) continue;
      this.que.splice(i, 1);
      --i;
      this.runTask(task);
    }
  }

  public runTask(task: Task) {
    const wrapFunc = () => {
      const nextUp = task.func();
      if (nextUp)
        this.addTask(task.ref, nextUp.f, nextUp.ac || Game.time, task.timeInit);
    };
    Apiary.wrap(wrapFunc, task.ref, "run", 1);
  }

  // #endregion Public Methods (3)
}
