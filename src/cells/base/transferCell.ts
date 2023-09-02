import { ManagerMaster } from "beeMasters/economy/manager";
import { TransferRequest } from "bees/transferRequest";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";

@profile
export class StorageCell extends Cell {}
