import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
    constructor(private dashboardService: DashboardService) { }

    /**
     * GET /api/dashboard/analytics
     * Returns aggregated analytics data for dashboard
     * Supports date range filtering via from, to, or period
     */
    @Get('analytics')
    getAnalytics(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('period') period?: string
    ) {
        return this.dashboardService.getAnalytics(from, to, period);
    }
}
