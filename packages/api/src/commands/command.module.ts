import { Module } from '@nestjs/common';

import { DbModule } from '../db/index.js';
import { EngineModule } from '../engine/engine.module.js';
import { PrismaModule } from '../prisma/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { CommandService } from './command.service.js';
import { ResetCommand } from './reset.command.js';
import { CompactCommand } from './compact.command.js';
import { HelpCommand } from './help.command.js';
import { PrayerCommand } from './prayer.command.js';

@Module({
  imports: [DbModule, EngineModule, PrismaModule, WorkspaceModule],
  providers: [
    ResetCommand,
    CompactCommand,
    HelpCommand,
    PrayerCommand,
    {
      provide: CommandService,
      useFactory: (
        resetCommand: ResetCommand,
        compactCommand: CompactCommand,
        helpCommand: HelpCommand,
        prayerCommand: PrayerCommand,
      ) => {
        const service = new CommandService([
          resetCommand,
          compactCommand,
          helpCommand,
          prayerCommand,
        ]);
        helpCommand.setCommandListGetter(() => service.getAll());
        return service;
      },
      inject: [ResetCommand, CompactCommand, HelpCommand, PrayerCommand],
    },
  ],
  exports: [CommandService],
})
export class CommandModule {}
