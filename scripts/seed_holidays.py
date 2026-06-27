#!/usr/bin/env python3
"""
Seed holidays for Spain + Andalusia + Málaga/Fuengirola.

Usage:
    python scripts/seed_holidays.py          # Seeds 2026
    python scripts/seed_holidays.py 2027     # Seeds 2027

This script uses the `python-holidays` library if available; otherwise falls back
to a built-in list of known holidays for Spain/Andalusia.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from datetime import date
from sqlmodel import Session, create_engine
from sqlalchemy import text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/barberapp"
)

# Known holidays for Spain + Andalusia (national + regional)
# These are fixed-date holidays. Moveable ones (Semana Santa, etc.) vary by year.
HOLIDAYS_2026 = [
    ("2026-01-01", "Año Nuevo", "New Year's Day", "national"),
    ("2026-01-06", "Día de Reyes", "Epiphany", "national"),
    ("2026-02-28", "Día de Andalucía", "Andalusia Day", "andalusia"),
    ("2026-04-03", "Viernes Santo", "Good Friday", "national"),
    ("2026-05-01", "Día del Trabajo", "Labour Day", "national"),
    ("2026-08-15", "Asunción de la Virgen", "Assumption Day", "national"),
    ("2026-10-12", "Fiesta Nacional de España", "National Day of Spain", "national"),
    ("2026-11-01", "Todos los Santos", "All Saints' Day", "national"),
    ("2026-12-06", "Día de la Constitución", "Constitution Day", "national"),
    ("2026-12-08", "Inmaculada Concepción", "Immaculate Conception", "national"),
    ("2026-12-25", "Navidad", "Christmas Day", "national"),
]

# Add more years here as needed
HOLIDAYS_BY_YEAR = {
    2026: HOLIDAYS_2026,
}


def main():
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026

    if year not in HOLIDAYS_BY_YEAR:
        print(f"No predefined holidays for year {year}. You can add them manually.")
        print(f"Known years: {list(HOLIDAYS_BY_YEAR.keys())}")
        # Still try to use python-holidays if available
        _try_seed_from_library(year)
        return

    engine = create_engine(DATABASE_URL, echo=True)

    with Session(engine) as db:
        existing = db.execute(
            text("SELECT COUNT(*) FROM holidays WHERE year = :y"),
            {"y": year}
        ).scalar() or 0

        if existing > 0:
            print(f"Year {year} already has {existing} holidays. Skipping seed.")
            print("Use admin panel to add/modify individual holidays.")
            return

        count = 0
        for date_str, name_es, name_en, region in HOLIDAYS_BY_YEAR[year]:
            holiday_date = date.fromisoformat(date_str)
            # Check if already exists (by date)
            dup = db.execute(
                text("SELECT id FROM holidays WHERE holiday_date = :d"),
                {"d": holiday_date}
            ).first()
            if dup:
                print(f"  Skipping {date_str} — already exists")
                continue

            db.execute(
                text("""
                    INSERT INTO holidays (holiday_date, name_es, name_en, year)
                    VALUES (:d, :nes, :nen, :y)
                """),
                {
                    "d": holiday_date,
                    "nes": name_es,
                    "nen": name_en,
                    "y": year,
                }
            )
            count += 1
            print(f"  + {date_str} {name_es}")

        db.commit()
        print(f"\nSeeded {count} holidays for {year}.")


def _try_seed_from_library(year):
    """Try using python-holidays library as fallback."""
    try:
        import holidays as pyholidays
    except ImportError:
        print("python-holidays not installed. Install with:")
        print("  pip install python-holidays")
        print(f"\nNo holidays seeded for {year}. Use admin panel to add them.")
        return

    engine = create_engine(DATABASE_URL, echo=True)

    es_holidays = pyholidays.ES(years=year, subdiv="AN")  # Andalusia
    count = 0

    with Session(engine) as db:
        for holiday_date, name in sorted(es_holidays.items()):
            dup = db.execute(
                text("SELECT id FROM holidays WHERE holiday_date = :d"),
                {"d": holiday_date}
            ).first()
            if dup:
                continue

            db.execute(
                text("""
                    INSERT INTO holidays (holiday_date, name_es, year)
                    VALUES (:d, :name, :y)
                """),
                {"d": holiday_date, "name": name, "y": year}
            )
            count += 1
            print(f"  + {holiday_date} {name}")

        db.commit()
        print(f"\nSeeded {count} holidays from python-holidays for {year}.")


if __name__ == "__main__":
    main()
