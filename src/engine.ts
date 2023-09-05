type Fn = () => void | Fn;

interface Task {
  // #region Properties (3)

  func: Fn;
  ref: string;
  time: number;

  // #endregion Properties (3)
}

/** what cpu to save based on bucket */
const CPU_ENGINE = {
  0: 10,
  1000: 1,
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
    _.forEach(CPU_ENGINE, (cpuSaveBucket, thrshBucket) => {
      if (cpuSaveBucket >= cpuToSave) return;
      if (Game.cpu.bucket > +thrshBucket!) return;
      cpuToSave = cpuSaveBucket;
    });
    return Game.cpu.limit - Game.cpu.getUsed() > cpuToSave;
  }

  // #endregion Private Accessors (1)

  // #region Public Methods (3)

  public addTask(ref: string, func: Fn, time = Game.time) {
    this.que.push({
      ref,
      func,
      time,
    });
  }

  public run() {
    while (this.canRun) {
      const task = this.que.shift();
      if (!task) break;
      if (task.time === Game.time) {
        // throttle for debug a little bit
        this.que.push(task);
        return;
      }
      this.runTask(task);
    }
  }

  public runTask(task: Task) {
    const wrapFunc = () => {
      const nextUp = task.func();
      if (nextUp) this.addTask(task.ref, nextUp, task.time);
    };
    Apiary.wrap(wrapFunc, task.ref, "run", 1);
  }

  // #endregion Public Methods (3)
}
