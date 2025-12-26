import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
    constructor(private statsService: StatsService) { }

    @Get()
    getStats(
        @Query('period') period: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('buyerId') buyerId?: string
    ) {
        return this.statsService.getStats(period, from, to, buyerId ? parseInt(buyerId) : undefined);
    }
}
