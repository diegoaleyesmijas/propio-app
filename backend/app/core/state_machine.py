"""
State machine for appointment status transitions.

Estados válidos: booked, completed, cancelled
- booked:    puede ir a completed o cancelled
- completed: estado terminal — no puede cambiar
- cancelled: estado terminal — no puede cambiar

Usar ALLOWED_TRANSITIONS para validar cualquier cambio de estado.
"""

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "booked":     {"completed", "cancelled"},
    "completed": set(),  # Terminal
    "cancelled": set(),  # Terminal
}

VALID_STATUSES: set[str] = set(ALLOWED_TRANSITIONS.keys())


def validate_transition(current: str, new_status: str) -> None:
    """
    Validate that a transition from `current` to `new_status` is allowed.

    Raises ValueError with a descriptive message if not allowed.
    Returns None on success.
    """
    if current not in ALLOWED_TRANSITIONS:
        raise ValueError(f"Unknown current status '{current}'")

    if new_status not in VALID_STATUSES:
        raise ValueError(f"Unknown target status '{new_status}'")

    if current == new_status:
        raise ValueError(
            f"Cannot change status from '{current}' to '{new_status}'. "
            f"Appointment is already {current}."
        )

    allowed = ALLOWED_TRANSITIONS[current]
    if new_status not in allowed:
        raise ValueError(
            f"Cannot change status from '{current}' to '{new_status}'. "
            f"Status '{current}' is terminal."
        )
