"""
Deal outcome analytics — read-only aggregated data.

Available to all authenticated users in a tenant.
Aggregates deal pipeline stages, outcomes, scorecard averages, dwell time per
stage, and a weekly invested-deal chart for the analytics dashboard.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Float, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.analysis import AnalysisResult, ScorecardScore
from app.models.base import Deal, DealStage, User

router = APIRouter(prefix="/analytics", tags=["analytics"])


class StageCount(BaseModel):
    stage: str
    count: int


class DwellTime(BaseModel):
    stage: str
    avg_days: float


class DimAverage(BaseModel):
    dimension_key: str
    avg_ai_score: float
    avg_human_score: float | None
    deal_count: int


class WeeklyInvested(BaseModel):
    week_start: str  # ISO date string
    count: int


class AnalyticsSummary(BaseModel):
    total_deals: int
    by_stage: list[StageCount]
    invested: int
    passed: int
    pass_rate: float | None
    dwell_time: list[DwellTime]
    scorecard_averages: list[DimAverage]
    weekly_invested: list[WeeklyInvested]


@router.get("", response_model=AnalyticsSummary)
async def get_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsSummary:
    # Stage distribution
    stage_counts = await db.execute(
        select(Deal.stage, func.count(Deal.id).label("cnt"))
        .where(Deal.tenant_id == user.tenant_id)
        .group_by(Deal.stage)
    )
    by_stage_rows = stage_counts.all()
    by_stage = [StageCount(stage=r.stage.value, count=r.cnt) for r in by_stage_rows]
    stage_map = {s.stage: s.count for s in by_stage}

    total_deals = sum(s.count for s in by_stage)
    invested = stage_map.get(DealStage.invested.value, 0)
    passed = stage_map.get(DealStage.passed.value, 0)
    terminal = invested + passed
    pass_rate = round(passed / terminal, 3) if terminal > 0 else None

    # Average dwell time per stage (seconds between enter and exit transitions)
    # For each (deal, stage) pair: time from when deal entered to when it left.
    # We compute this as: for each exit transition, lag the entry timestamp.
    dwell_rows = await db.execute(
        text("""
            SELECT
                from_stage AS stage,
                AVG(
                    EXTRACT(EPOCH FROM (t2.created_at - t1.created_at)) / 86400.0
                ) AS avg_days
            FROM pipeline_transitions t1
            JOIN pipeline_transitions t2
                ON t2.deal_id = t1.deal_id
                AND t2.from_stage = t1.to_stage
                AND t2.created_at > t1.created_at
            WHERE t1.tenant_id = :tid
            GROUP BY from_stage
        """),
        {"tid": str(user.tenant_id)},
    )
    dwell_time = [
        DwellTime(stage=r.stage, avg_days=round(float(r.avg_days), 1))
        for r in dwell_rows.all()
        if r.stage is not None
    ]

    # Scorecard dimension averages (across all completed analyses)
    sc_rows = await db.execute(
        select(
            ScorecardScore.dimension_key,
            func.avg(cast(ScorecardScore.ai_score, Float)).label("avg_ai"),
            func.avg(cast(ScorecardScore.human_score, Float)).label("avg_human"),
            func.count(ScorecardScore.id).label("deal_count"),
        )
        .join(AnalysisResult, ScorecardScore.analysis_id == AnalysisResult.id)
        .where(AnalysisResult.tenant_id == user.tenant_id)
        .group_by(ScorecardScore.dimension_key)
        .order_by(ScorecardScore.dimension_key)
    )
    dim_avgs = [
        DimAverage(
            dimension_key=r.dimension_key,
            avg_ai_score=round(float(r.avg_ai), 2),
            avg_human_score=round(float(r.avg_human), 2) if r.avg_human is not None else None,
            deal_count=r.deal_count,
        )
        for r in sc_rows.all()
    ]

    # Weekly invested deal count — past 12 weeks (Mon–Sun buckets)
    twelve_weeks_ago = datetime.now(UTC) - timedelta(weeks=12)
    weekly_rows = await db.execute(
        text("""
            SELECT
                DATE_TRUNC('week', created_at AT TIME ZONE 'UTC') AS week_start,
                COUNT(*) AS cnt
            FROM pipeline_transitions
            WHERE tenant_id = :tid
              AND to_stage = 'invested'
              AND created_at >= :since
            GROUP BY week_start
            ORDER BY week_start
        """),
        {"tid": str(user.tenant_id), "since": twelve_weeks_ago},
    )
    weekly_invested = [
        WeeklyInvested(week_start=r.week_start.date().isoformat(), count=int(r.cnt))
        for r in weekly_rows.all()
    ]

    return AnalyticsSummary(
        total_deals=total_deals,
        by_stage=by_stage,
        invested=invested,
        passed=passed,
        pass_rate=pass_rate,
        dwell_time=dwell_time,
        scorecard_averages=dim_avgs,
        weekly_invested=weekly_invested,
    )
