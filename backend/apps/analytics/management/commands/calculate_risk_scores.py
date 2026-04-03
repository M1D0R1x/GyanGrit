from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Sum, Count, Min, Max
from apps.accounts.models import User
from apps.analytics.models import StudentRiskScore, EngagementEvent, EventType
from apps.assessments.models import AssessmentAttempt

class Command(BaseCommand):
    help = "Calculates the student risk scores based on engagement drop-offs and low assessment scores."

    def handle(self, *args, **options):
        today = timezone.now().date()
        seven_days_ago = today - timedelta(days=7)
        fourteen_days_ago = today - timedelta(days=14)

        students = User.objects.filter(role="STUDENT", is_active=True)

        for student in students:
            score = 0.0
            factors = {}

            # 1. Missed streaks: no login for 3+ days
            recent_logins = EngagementEvent.objects.filter(
                user=student,
                event_type=EventType.LOGIN,
                event_date__gte=today - timedelta(days=3)
            ).count()

            if recent_logins == 0:
                score += 30.0
                factors["streak_broken"] = True
                factors["days_since_login"] = "3+"

            # 2. Drop-off in engagement: comparing prior week to current week
            recent_minutes = EngagementEvent.objects.filter(
                user=student,
                event_date__gte=seven_days_ago
            ).aggregate(total=Sum("duration_seconds"))["total"] or 0
            
            prior_minutes = EngagementEvent.objects.filter(
                user=student,
                event_date__lt=seven_days_ago,
                event_date__gte=fourteen_days_ago
            ).aggregate(total=Sum("duration_seconds"))["total"] or 0

            # If prior week had > 60 mins AND recent week has 50% drop
            if prior_minutes > 3600 and recent_minutes < (prior_minutes * 0.5):
                score += 25.0
                factors["engagement_drop"] = f"Dropped from {prior_minutes//60}m to {recent_minutes//60}m"

            # 3. Low assessment scores recently
            recent_attempts = AssessmentAttempt.objects.filter(
                user=student,
                submitted_at__gte=seven_days_ago
            )
            failed_count = sum(1 for a in recent_attempts if not a.passed)
            
            if failed_count > 0:
                score += (15.0 * min(failed_count, 3))
                factors["recent_failures"] = failed_count

            # Cap score to 100
            score = min(score, 100.0)

            # Determine Risk Level
            if score >= 60.0:
                risk_level = StudentRiskScore.RiskLevel.HIGH
            elif score >= 30.0:
                risk_level = StudentRiskScore.RiskLevel.MEDIUM
            else:
                risk_level = StudentRiskScore.RiskLevel.LOW

            # Update or create Risk Score
            risk, created = StudentRiskScore.objects.update_or_create(
                user=student,
                defaults={
                    "score": score,
                    "risk_level": risk_level,
                    "factors": factors
                }
            )

        self.stdout.write(self.style.SUCCESS('Successfully calculated risk scores for all active students.'))
