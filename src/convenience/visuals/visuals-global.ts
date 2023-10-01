import type { Visuals } from "./visuals";

export function globalStats(this: Visuals) {
  const size = 6.2;
  const style: { align: "right" } = { align: "right" };

  if (!Apiary.useBucket) this.label("LOW CPU", size, size, undefined, style);

  this.progressbar(
    Math.round(Game.cpu.getUsed() * 100) / 100 + " : CPU",
    Game.cpu.getUsed() / Game.cpu.limit,
    size,
    size,
    style
  );

  this.progressbar(
    (Game.cpu.bucket === 10000 ? "10K" : Math.round(Game.cpu.bucket)) +
      " : BUCKET",
    Game.cpu.bucket / 10000,
    size,
    size,
    style
  );
  this.progressbar(
    Game.gcl.level + "→" + (Game.gcl.level + 1) + " : GCL",
    Game.gcl.progress / Game.gcl.progressTotal,
    size,
    size,
    style
  );
  const heapStat = Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics();
  if (heapStat)
    this.progressbar(
      "HEAP",
      heapStat.used_heap_size / heapStat.total_available_size,
      size,
      size,
      style
    );
}
