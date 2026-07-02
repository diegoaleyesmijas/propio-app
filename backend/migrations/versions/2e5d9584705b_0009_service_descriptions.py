"""0009_service_descriptions

Revision ID: 2e5d9584705b
Revises: f8eaa6de7f01
Create Date: 2026-06-30 16:06:59.336955

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e5d9584705b'
down_revision: Union[str, Sequence[str], None] = 'f8eaa6de7f01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE services ADD COLUMN description TEXT;")

    op.execute("""
        UPDATE services SET description = 'Por favor paga en efectivo. Colabora con tu profesional. Entre todos nos ayudamos.' WHERE name = 'Pagar en efectivo';
    """)
    op.execute("""
        UPDATE services SET description = 'Servicio de disimulacion de canas con productos especificos sin amoniaco dejando un acabado muy natural. Servicio para cabellos cortos.' WHERE name = 'Camuflaje de canas';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte de cabello y mascarilla exfoliante Detox logrando un super acabado y una relajacion total, luego terminamos con un muy buen lavado de cabeza. Higiene masculina.' WHERE name = 'Pack Clásico';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte de cabello y afeitado premium acompañado de una mascarilla exfoliante Detox para limpiar bien el rostro y un masaje relajante para culminar este excelente servicio. Luego un buen lavado de cabello.' WHERE name = 'Pack Pro';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte premium, afeitado de barba y un producto a eleccion: cera de agua, polvo voluminizador o aceite de barba y un muy buen lavado Detox relajante de cabello.' WHERE name = 'Pack Gentleman';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte de niño hasta 6 años.' WHERE name = 'Corte nino hasta 6';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte de Caballero acompañado de un muy buen lavado relajante, y todo el asesoramiento en el corte que mas te beneficie. Tu eres nuestra inspiracion.' WHERE name = 'Corte premium con lavado';
    """)
    op.execute("""
        UPDATE services SET description = 'Corte de cabello a navaja, dejando un acabado de otra dimension, solo para entendidos. Tu nos inspiras.' WHERE name = 'Corte a navaja';
    """)
    op.execute("""
        UPDATE services SET description = 'Servicio de muy buena calidad donde te relajas de tal forma que se te hace costumbre. Tu eres nuestra inspiracion.' WHERE name = 'Barba + corte';
    """)
    op.execute("""
        UPDATE services SET description = 'Ritual con vapor y masaje facial y un excelente servicio donde la relajacion y el estres desaparecen por un momento, un buen lavado de cabeza y toda la calidad en la atencion. Utilizacion de productos de calidad y todo el asesoramiento. Una experiencia diferente en la costa del sol.' WHERE name = 'Premium caballero';
    """)
    op.execute("""
        UPDATE services SET description = 'Arreglo de barba con productos antisepticos y antibacteriales, porque un buen enmarcado y delineado marcan la diferencia.' WHERE name = 'Arreglo de barba y diseno';
    """)
    op.execute("""
        UPDATE services SET description = 'Afeitado con ritual.' WHERE name = 'Afeitado premium con ritual';
    """)
    op.execute("""
        UPDATE services SET description = 'Color de barba.' WHERE name = 'Color de barba';
    """)
    op.execute("""
        UPDATE services SET description = 'Tinte en el cabello. Precio varia segun cantidad de cabello, largo y tonalidad.' WHERE name = 'Tinte de cabello';
    """)
    op.execute("""
        UPDATE services SET description = 'El servicio varia de precio dependiendo del trabajo y la altura de tono. Desde 50€.' WHERE name = 'Reflejos con gorro';
    """)
    op.execute("""
        UPDATE services SET description = 'Un servicio de alta calidad con productos que cuidan tu cabello. Desde 65€.' WHERE name = 'Color platinado o blanco';
    """)
    op.execute("""
        UPDATE services SET description = 'Trabajo tecnico cuidando muy bien el cabello con productos de primera linea. Los precios son variables segun la cantidad de cabello y el largo. Desde 50€.' WHERE name = 'Permanente pelo corto';
    """)
    op.execute("""
        UPDATE services SET description = 'Alisado permanente sin formol. Cabello sano y cuidado en manos profesionales. Duracion 1:30 hs aprox. Con productos de calidad. El precio varia dependiendo la cantidad de cabello. Desde 55€.' WHERE name = 'Alisado pelo corto';
    """)
    op.execute("""
        UPDATE services SET description = 'Depilacion de nariz y oidos con cera caliente.' WHERE name = 'Cera nariz y oidos';
    """)
    op.execute("""
        UPDATE services SET description = 'Buena y relajante limpieza de cutis con vapor y ozono dandole al rostro un acabado y suavidad tremendo. Relax total.' WHERE name = 'Limpieza de cutis';
    """)
    op.execute("""
        UPDATE services SET description = 'Servicio de higiene masculina con una limpieza profunda y exfoliante que rejuvenece tu piel dejandola muy suave y luego mascarilla negra para quitar impurezas. Excelente y muy relajante.' WHERE name = 'Limpieza facial y mascarilla';
    """)
    op.execute("""
        UPDATE services SET description = 'Servicio a domicilio de Peluqueria y Barberia, donde el trabajo personalizado pensado en ti es de primera calidad. Desde 95€. Pedir cita con anticipacion minimo 3 dias por favor.' WHERE name = 'A domicilio';
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE services DROP COLUMN IF EXISTS description;")
