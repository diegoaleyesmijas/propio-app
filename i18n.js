/*
 * i18n — Diccionario bilingüe ES/EN para el MVP.
 * Sin dependencias, sin localStorage obligatorio.
 * Usado por demo.js y admin.js.
 */

const LANG_KEY = 'barber_lang'
let _memoryLang = null

const dict = {
  es: {
    brand: 'Código de Caballeros Salon',

    // Header / steps (demo)
    'step.service': 'Elige tu servicio',
    'step.slot': 'Elige día y hora',
    'step.form': 'Tus datos',
    'step.success': '¡Listo!',
    'step.manage': 'Tu reserva',

    // Booking (demo)
    'booking.title': 'Reserva en 30 segundos',
    'booking.subtitle': 'Elige el servicio que necesitas hoy.',
    'booking.service_selected': 'Servicio elegido',
    'booking.iva_incl': 'IVA inc.',
    'booking.stepper': 'Paso {0} de 3',
    'booking.continue': 'Continuar',
    'booking.today': 'Hoy',
    'booking.day': 'Día',
    'booking.available_time': 'Hora disponible',
    'booking.no_slots': 'Sin huecos disponibles',
    'booking.try_other': 'Prueba con otro día',
    'booking.next_available': 'Ver próximo día libre',

    // Form (demo)
    'form.name': 'Nombre completo',
    'form.name_ph': 'Juan Pérez',
    'form.phone': 'Teléfono',
    'form.phone_ph': '+34 600 000 000',
    'form.email': 'Email (opcional, para confirmación)',
    'form.email_ph': 'tu@email.com',
    'form.summary': 'Tu reserva',
    'form.submit': 'Confirmar reserva',
    'form.loading': 'Reservando…',
    'form.disclaimer': 'Sin pagos por adelantado · Cancela hasta 24h antes',
    'form.is_first': '¿Es tu primera vez en Código de Caballeros?',
    'form.first_yes': 'Sí, soy nuevo',
    'form.first_no': 'Ya conozco',

    // Footer (demo)
    'footer.powered': 'Creado por',

    // Success (demo)
    'success.heading': '¡Reserva confirmada!',
    'success.welcome': '✨ ¡Bienvenido a Código de Caballeros Salon!',
    'success.message': 'Te hemos enviado un email con el enlace para gestionar o cancelar tu cita.',
    'success.summary': 'Resumen',
    'success.service': 'Servicio',
    'success.add_calendar': 'Añadir a calendario',
    'success.new_booking': 'Hacer otra reserva',

    // Manage (demo)
    'manage.heading': 'Tu cita',
    'manage.service': 'Servicio',
    'manage.status': 'Estado',
    'manage.cancel': 'Cancelar cita',

    // Admin header
    'admin.title': 'Panel interno · Barbero',
    'admin.login_title': 'Panel interno',
    'admin.username': 'Usuario',
    'admin.password': 'Contraseña',
    'admin.login_btn': 'Iniciar sesión',
    'admin.login_error': 'Usuario o contraseña incorrectos',
    'admin.login_help': '¿Problemas para acceder? Contacta con soporte',
    'admin.complete': 'Completar',
    'admin.cancel': 'Cancelar',
    'admin.cancel_confirm': '¿Anular esta reserva? La cita se cancelará permanentemente.',
    'admin.refresh': 'Refrescar',

    // Admin tabs
    'admin.tab.agenda': 'Agenda',
    'admin.tab.upcoming': 'Próximas',
    'admin.tab.clients': 'Clientes',
    'admin.tab.dashboard': 'Panel',
    'admin.tab.settings': 'Configuración',

    // Admin KPI cards
    'admin.kpi_bookings_today': 'Reservas hoy',
    'admin.kpi_new_clients': 'Nuevos este mes',
    'admin.kpi_reactivate': 'Por reactivar',
    'admin.kpi_monthly_revenue': 'Ingresos del mes',
    'admin.kpi_view_agenda': 'Ver agenda',
    'admin.kpi_view_clients': 'Ver clientes',
    'admin.kpi_see_list': 'Ver lista',
    'admin.kpi_clients_30d': 'clientes +30d',
    'admin.kpi_see_all_clients': 'Ver todos los clientes',
    'admin.kpi_no_reactivate': 'Todos los clientes han visitado recientemente',
    'admin.booking': 'cita',
    'admin.bookings': 'citas',
    'admin.this_month': 'este mes',
    'admin.days': 'días',
    'admin.new_booking': 'Nueva reserva',
    'admin.today': 'Hoy',
    'admin.next_appointment': 'Próxima cita',
    'admin.no_next_appointment': 'Sin próximas citas',
    'admin.no_next_appointment_sub': 'La agenda está libre por ahora',

    // Admin agenda
    'admin.agenda_of': 'Agenda del',
    'admin.booked': 'Reservadas',
    'admin.completed': 'Completadas',
    'admin.revenue': 'Ingresos',
    'admin.loading': 'Cargando…',
    'admin.agenda_empty': 'Día libre',
    'admin.agenda_empty_sub': 'No hay citas para esta fecha',

    // Admin dashboard
    'admin.dashboard_title': 'Panel de control',
    'admin.dashboard_revenue': 'Ingresos este mes',
    'admin.dashboard_vs_prev': 'vs mes anterior',
    'admin.dashboard_avg_ticket': 'Ticket medio',
    'admin.dashboard_booked': 'Reservadas',
    'admin.dashboard_completed': 'Completadas',
    'admin.dashboard_new_clients': 'Nuevos',
    'admin.dashboard_total_clients': 'Total clientes',
    'admin.dashboard_revenue_compare': 'Comparativa mensual',
    'admin.dashboard_current_month': 'Este mes',
    'admin.dashboard_prev_month': 'Mes anterior',

    // Dashboard revenue detail
    'admin.revenue_detail_title': 'Detalle de ingresos',
    'admin.revenue_daily': 'Día',
    'admin.revenue_weekly': 'Semana',
    'admin.revenue_monthly': 'Mes',
    'admin.revenue_total_month': 'Total del mes',
    'admin.revenue_avg_daily': 'Media diaria',
    'admin.revenue_best_day': 'Mejor día',
    'admin.revenue_no_data': 'Sin datos para este período',
    'admin.revenue_week_label': 'Semana {0}',
    'admin.revenue_day_label': '{0} {1}',
    'admin.revenue_range_3m': '3 meses',
    'admin.revenue_range_6m': '6 meses',
    'admin.revenue_range_12m': '12 meses',

    // Day summary
    'admin.day_revenue': 'Ingresos hoy',
    'admin.day_completed': 'Atendidos hoy',
    'admin.day_cancelled': 'Cancelados hoy',
    'admin.day_unit_revenue': '€',
    'admin.day_unit_completed': 'clientes',
    'admin.day_unit_cancelled': 'cancelados',

    // Donut chart
    'admin.status_distribution': 'Estado de las citas',
    'admin.total_bookings': 'Total citas',

    // Admin upcoming
    'admin.upcoming_title': 'Próximas citas',
    'admin.upcoming_sub': 'Las 7 siguientes reservas activas',
    'admin.upcoming_empty': 'Nada pendiente',
    'admin.upcoming_empty_sub': 'No hay reservas próximas',

    // Admin clients
    'admin.clients_title': 'Clientes',
    'admin.clients_search': 'Buscar por nombre, teléfono o email…',
    'admin.clients_empty': 'Sin clientes',
    'admin.clients_empty_sub': 'Aún no hay clientes registrados',
    'admin.clients_filter_empty': 'Sin resultados',
    'admin.clients_filter_sub': 'Prueba con otro término',
    'admin.export_clients': 'Exportar CSV',
    'admin.total': 'Total',
    'admin.new_count': 'Nuevos',
    'admin.days_ago': 'días sin visita',
    'admin.client_new': 'Nuevo',
    'admin.new_month': 'Nuevos/mes',

    // Toast
    'admin.toast_new_suffix': ' · Nuevo',
    'admin.close': 'Cerrar',

    // Modal first-time toggle
    'modal.is_first': '¿Es su primera vez?',
    'modal.first_yes': 'Sí, es nuevo',
    'modal.first_no': 'Ya ha venido',

    // Settings / Config
    'settings.title': 'Configuración',
    'settings.horarios': 'Horarios',
    'settings.festivos': 'Festivos',
    'settings.bloques': 'Bloqueos',
    'settings.seasons_empty': 'Sin temporadas',
    'settings.seasons_empty_sub': 'Usando horario por defecto',
    'settings.add_season': 'Añadir temporada',
    'settings.edit_season': 'Editar temporada',
    'settings.season_name': 'Nombre',
    'settings.season_name_ph': 'Verano 2026',
    'settings.season_start': 'Inicio',
    'settings.season_end': 'Fin',
    'settings.season_hours': 'Horario por día',
    'settings.season_morning': 'Mañana',
    'settings.season_afternoon': 'Tarde',
    'settings.season_active': 'Activa',
    'settings.season_inactive': 'Inactiva',
    'settings.delete_season': 'Eliminar',
    'settings.delete_season_confirm': '¿Eliminar temporada?',
    'settings.save_season': 'Guardar temporada',
    'settings.saving': 'Guardando…',
    'settings.season_saved': 'Temporada guardada',
    'settings.add_holiday': 'Añadir festivo',
    'settings.holiday_date': 'Fecha',
    'settings.holiday_name': 'Nombre',
    'settings.holiday_name_es': 'Nombre (ES)',
    'settings.holiday_name_en': 'Nombre (EN)',
    'settings.holiday_empty': 'Sin festivos',
    'settings.holiday_empty_sub': 'Añade los festivos del año',
    'settings.delete_holiday': 'Eliminar',
    'settings.delete_holiday_confirm': '¿Eliminar festivo?',
    'settings.holiday_saved': 'Festivo añadido',
    'settings.add_block': 'Añadir bloqueo',
    'settings.block_date': 'Fecha',
    'settings.block_type': 'Tipo',
    'settings.block_full_day': 'Día completo',
    'settings.block_time_range': 'Franja horaria',
    'settings.block_start': 'Desde',
    'settings.block_end': 'Hasta',
    'settings.block_reason': 'Motivo',
    'settings.block_reason_ph': 'Vacaciones, médico, partido…',
    'settings.block_empty': 'Sin bloqueos',
    'settings.block_empty_sub': 'Bloquea días u horas no disponibles',
    'settings.delete_block': 'Eliminar',
    'settings.delete_block_confirm': '¿Eliminar bloqueo?',
    'settings.block_saved': 'Bloqueo creado',
    'settings.google_reviews': 'Reseñas de Google',
    'settings.google_placeholder': 'ID de Google Place',
    'settings.google_ph': 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    'settings.google_saved': 'Guardado',
    'settings.view_reviews': 'Ver en Google →',
    'settings.reset_demo': 'Resetear datos demo',
    'settings.reset_demo_desc': 'Borra todas las citas y clientes marcados como demo. No afecta a datos reales.',
    'settings.reset_demo_confirm': '¿Resetear todos los datos demo? Esta acción no se puede deshacer.',
    'settings.reset_demo_btn': 'Sí, borrar datos demo',
    'settings.reset_demo_cancel': 'Cancelar',
    'settings.reset_demo_error': 'Error al resetear datos demo',
    'settings.reset_demo_success': 'Datos demo borrados: {0} citas, {1} clientes',
    'settings.push_title': 'Notificaciones push',
    'settings.push_desc': 'Recibe notificaciones en el móvil cuando entren nuevas reservas.',
    'settings.push_activate': 'Activar notificaciones',
    'settings.push_deactivate': 'Desactivar notificaciones',
    'settings.push_activated': 'Notificaciones activadas',
    'settings.push_not_supported': 'Tu navegador no soporta notificaciones push',
    'settings.push_ios_guide': 'En iPhone: añade esta web a la pantalla de inicio (Compartir → Añadir a Pantalla de Inicio) para recibir notificaciones.',
    'settings.push_denied': 'Permiso denegado. Cambia los ajustes de notificaciones en tu navegador.',
    'settings.push_error': 'Error al activar notificaciones',

    // Admin status labels
    'status.booked': 'Reservada',
    'status.completed': 'Completada',
    'status.cancelled': 'Cancelada',

    // Modal (admin)
    'modal.title': 'Nueva reserva',
    'modal.step1': 'Paso 1: selecciona el servicio',
    'modal.step2': 'Paso 2: elige día y hora',
    'modal.step3': 'Datos del cliente',
    'modal.summary_line': '{0} · {1} {2}',
    'modal.name': 'Nombre completo *',
    'modal.phone': 'Teléfono *',
    'modal.email': 'Email (opcional)',
    'modal.email_ph': 'cliente@email.com',
    'modal.submit': 'Reservar',
    'modal.loading': 'Reservando…',
    'modal.continue': 'Continuar',
    'modal.no_slots': 'Sin huecos disponibles para este día',

    // Relative time
    'relative.today': 'hoy',
    'relative.tomorrow': 'mañana',
    'relative.in_days': 'en {0} días',

    // Admin visit count
    'visit.singular': 'visita',
    'visit.plural': 'visitas',

    // Registered count
    'admin.registered': '{0} registrados',
    'admin.inactive_clients': 'Inactivos (30+ días)',
    'admin.logout': 'Cerrar sesión',
    'admin.delete_client': 'Eliminar cliente',
    'admin.delete_confirm': 'Sí, eliminar',
    'admin.delete_cancel': 'Cancelar',
    'admin.delete_warning': 'Las citas pasadas se conservarán.',
    'admin.delete_warning_action': 'Esta acción no se puede deshacer. Los datos del cliente se eliminarán permanentemente.',
    'admin.delete_success': 'Cliente eliminado',

    // Templates (shared patterns — same in both languages for MVP)
    'template.duration_min': '{0} min',
    'template.duration_price': '{0} min · {1}€',
    'template.summary': '{0} · {1} {2}',
    'template.service_phone': '{0} · {1}',

    // Agenda views
    'agenda.day': 'Día',
    'agenda.week': 'Semana',
    'agenda.month': 'Mes',
    'agenda.weekly_title': 'Semana del {0}',
    'agenda.monthly_title': '{0} {1}',
    'agenda.month_short_0': 'Ene', 'agenda.month_short_1': 'Feb', 'agenda.month_short_2': 'Mar',
    'agenda.month_short_3': 'Abr', 'agenda.month_short_4': 'May', 'agenda.month_short_5': 'Jun',
    'agenda.month_short_6': 'Jul', 'agenda.month_short_7': 'Ago', 'agenda.month_short_8': 'Sep',
    'agenda.month_short_9': 'Oct', 'agenda.month_short_10': 'Nov', 'agenda.month_short_11': 'Dic',
    'agenda.day_short_0': 'Lu', 'agenda.day_short_1': 'Ma', 'agenda.day_short_2': 'Mi',
    'agenda.day_short_3': 'Ju', 'agenda.day_short_4': 'Vi', 'agenda.day_short_5': 'Sa',
    'agenda.day_short_6': 'Do',
    'agenda.prev': '← Anterior',
    'agenda.next': 'Siguiente →',
    'agenda.today': 'Hoy',
    'agenda.no_data': 'Sin citas este día',
    'agenda.book': 'reserva',
    'agenda.books': 'reservas',

    // Notifications
    'notif.title': 'Notificaciones',
    'notif.empty': 'Sin notificaciones nuevas',
    'notif.new_booking': 'Nueva reserva de {0}',
    'notif.new_booking_detail': '{0} · {1}',
    'notif.sound_on': 'Sonido activado',
    'notif.sound_off': 'Sonido desactivado',
    'notif.dismiss': 'Descartar notificación',
    'notif.toast_title': 'Nueva reserva',

    // Client CRM
    'crm.title': 'Ficha del cliente',
    'crm.back': '← Volver a clientes',
    'crm.info': 'Información',
    'crm.history': 'Historial de visitas',
    'crm.stats': 'Estadísticas',
    'crm.total_visits': 'Visitas totales',
    'crm.completed_visits': 'Completadas',
    'crm.cancelled_visits': 'Canceladas',
    'crm.total_spent': 'Gasto total',
    'crm.service_breakdown': 'Servicios realizados',
    'crm.last_visit': 'Última visita',
    'crm.member_since': 'Cliente desde',
    'crm.edit_success': 'Cliente actualizado',
    'crm.edit': 'Editar',
    'crm.save': 'Guardar cambios',
    'crm.saving': 'Guardando…',
    'crm.no_history': 'Sin visitas registradas',
    'crm.notes': 'Notas',
    'crm.notes_optional': 'opcional',
    'crm.notes_placeholder': 'Ej: prefiere los jueves, pelo rizado, atento al teléfono…',
    'crm.notes_section': 'Notas internas',
    'crm.save_notes': 'Guardar nota',
    'crm.notes_saved': 'Nota guardada',
    'crm.client_since': 'Cliente desde',
    'crm.whatsapp': 'Enviar WhatsApp',
    'crm.whatsapp_msg': '¡Hola {0}! Soy tu barbero de Código de Caballeros. Te escribo para confirmar tu próxima cita.',

    // API errors
    'error.services': 'No se pudieron cargar los servicios',
    'error.slots': 'No se pudieron cargar los horarios',
    'error.create': 'Error al crear la reserva',
    'error.not_found': 'Reserva no encontrada',
    'error.cancel': 'No se pudo cancelar',
    'error.agenda': 'No se pudo cargar la agenda',
    'error.clients': 'No se pudieron cargar los clientes',
    'error.upcoming': 'No se pudieron cargar próximas citas',
    'error.update': 'No se pudo actualizar',
    'error.client_detail': 'No se pudo cargar el detalle del cliente',
    'error.notifications': 'No se pudieron cargar notificaciones',
    'error.blocks': 'No se pudieron cargar los bloqueos',
  },

  en: {
    brand: 'Código de Caballeros Salon',

    'step.service': 'Choose your service',
    'step.slot': 'Choose day and time',
    'step.form': 'Your details',
    'step.success': 'Done!',
    'step.manage': 'Your booking',

    'booking.title': 'Book in 30 seconds',
    'booking.subtitle': 'Choose the service you need today.',
    'booking.service_selected': 'Selected service',
    'booking.iva_incl': 'VAT incl.',
    'booking.stepper': 'Step {0} of 3',
    'booking.continue': 'Continue',
    'booking.today': 'Today',
    'booking.day': 'Day',
    'booking.available_time': 'Available time',
    'booking.no_slots': 'No available slots',
    'booking.try_other': 'Try another day',
    'booking.next_available': 'Next available day',

    'form.name': 'Full name',
    'form.name_ph': 'John Doe',
    'form.phone': 'Phone',
    'form.phone_ph': '+34 600 000 000',
    'form.email': 'Email (optional, for confirmation)',
    'form.email_ph': 'your@email.com',
    'form.summary': 'Your booking',
    'form.submit': 'Confirm booking',
    'form.loading': 'Booking…',
    'form.disclaimer': 'No upfront payment · Cancel up to 24h before',
    'form.is_first': 'Your first time at Código de Caballeros?',
    'form.first_yes': "Yes, I'm new",
    'form.first_no': "I've been before",

    // Footer (demo)
    'footer.powered': 'Powered by',

    'success.heading': 'Booking confirmed!',
    'success.welcome': '✨ Welcome to Código de Caballeros Salon!',
    'success.message': 'We have sent you an email with the link to manage or cancel your appointment.',
    'success.summary': 'Summary',
    'success.service': 'Service',
    'success.add_calendar': 'Add to calendar',
    'success.new_booking': 'Make another booking',

    'manage.heading': 'Your appointment',
    'manage.service': 'Service',
    'manage.status': 'Status',
    'manage.cancel': 'Cancel appointment',

    'admin.title': 'Dashboard · Barber',
    'admin.login_title': 'Admin Panel',
    'admin.username': 'Username',
    'admin.password': 'Password',
    'admin.login_btn': 'Log in',
    'admin.login_error': 'Invalid credentials',
    'admin.login_help': 'Having trouble? Contact support',
    'admin.complete': 'Complete',
    'admin.cancel': 'Cancel',
    'admin.cancel_confirm': 'Cancel this appointment? The booking will be permanently cancelled.',
    'admin.refresh': 'Refresh',

    'admin.tab.agenda': 'Agenda',
    'admin.tab.upcoming': 'Upcoming',
    'admin.tab.clients': 'Clients',
    'admin.tab.dashboard': 'Dashboard',
    'admin.tab.settings': 'Settings',

    // Admin KPI cards
    'admin.kpi_bookings_today': "Today's bookings",
    'admin.kpi_new_clients': 'New this month',
    'admin.kpi_reactivate': 'To reactivate',
    'admin.kpi_monthly_revenue': 'Monthly revenue',
    'admin.kpi_view_agenda': 'View agenda',
    'admin.kpi_view_clients': 'View clients',
    'admin.kpi_see_list': 'See list',
    'admin.kpi_clients_30d': 'clients +30d',
    'admin.kpi_see_all_clients': 'See all clients',
    'admin.kpi_no_reactivate': 'All clients have visited recently',
    'admin.booking': 'booking',
    'admin.bookings': 'bookings',
    'admin.this_month': 'this month',
    'admin.days': 'days',
    'admin.new_booking': 'New booking',
    'admin.today': 'Today',
    'admin.next_appointment': 'Next appointment',
    'admin.no_next_appointment': 'No upcoming appointments',
    'admin.no_next_appointment_sub': 'The agenda is clear for now',

    'admin.agenda_of': 'Agenda for',
    'admin.booked': 'Booked',
    'admin.completed': 'Completed',
    'admin.revenue': 'Revenue',
    'admin.loading': 'Loading…',
    'admin.agenda_empty': 'Day off',
    'admin.agenda_empty_sub': 'No appointments for this date',

    // Admin dashboard
    'admin.dashboard_title': 'Dashboard',
    'admin.dashboard_revenue': 'Revenue this month',
    'admin.dashboard_vs_prev': 'vs last month',
    'admin.dashboard_avg_ticket': 'Avg. ticket',
    'admin.dashboard_booked': 'Booked',
    'admin.dashboard_completed': 'Completed',
    'admin.dashboard_new_clients': 'New clients',
    'admin.dashboard_total_clients': 'Total clients',
    'admin.dashboard_revenue_compare': 'Monthly comparison',
    'admin.dashboard_current_month': 'This month',
    'admin.dashboard_prev_month': 'Last month',

    // Dashboard revenue detail
    'admin.revenue_detail_title': 'Revenue Detail',
    'admin.revenue_daily': 'Day',
    'admin.revenue_weekly': 'Week',
    'admin.revenue_monthly': 'Month',
    'admin.revenue_total_month': 'Month total',
    'admin.revenue_avg_daily': 'Daily avg',
    'admin.revenue_best_day': 'Best day',
    'admin.revenue_no_data': 'No data for this period',
    'admin.revenue_week_label': 'Week {0}',
    'admin.revenue_day_label': '{0} {1}',
    'admin.revenue_range_3m': '3 months',
    'admin.revenue_range_6m': '6 months',
    'admin.revenue_range_12m': '12 months',

    // Day summary
    'admin.day_revenue': "Today's revenue",
    'admin.day_completed': 'Completed today',
    'admin.day_cancelled': 'Cancelled today',
    'admin.day_unit_revenue': '€',
    'admin.day_unit_completed': 'clients',
    'admin.day_unit_cancelled': 'cancelled',

    // Donut chart
    'admin.status_distribution': 'Booking status',
    'admin.total_bookings': 'Total bookings',

    'admin.upcoming_title': 'Upcoming appointments',
    'admin.upcoming_sub': 'Next 7 active bookings',
    'admin.upcoming_empty': 'Nothing pending',
    'admin.upcoming_empty_sub': 'No upcoming bookings',

    'admin.clients_title': 'Clients',
    'admin.clients_search': 'Search by name, phone or email…',
    'admin.clients_empty': 'No clients',
    'admin.clients_empty_sub': 'No clients registered yet',
    'admin.clients_filter_empty': 'No results',
    'admin.clients_filter_sub': 'Try a different search term',
    'admin.export_clients': 'Export CSV',
    'admin.total': 'Total',
    'admin.new_count': 'New',
    'admin.days_ago': 'days since visit',
    'admin.client_new': 'New',
    'admin.new_month': 'New/month',

    // Toast
    'admin.toast_new_suffix': ' · New',
    'admin.close': 'Close',

    // Modal first-time toggle
    'modal.is_first': 'First time here?',
    'modal.first_yes': 'Yes, first time',
    'modal.first_no': 'Not their first',

    'status.booked': 'Booked',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',

    'modal.title': 'New booking',
    'modal.step1': 'Step 1: select a service',
    'modal.step2': 'Step 2: choose day and time',
    'modal.step3': 'Customer details',
    'modal.summary_line': '{0} · {1} {2}',
    'modal.name': 'Full name *',
    'modal.phone': 'Phone *',
    'modal.email': 'Email (optional)',
    'modal.email_ph': 'client@email.com',
    'modal.submit': 'Book',
    'modal.loading': 'Booking…',
    'modal.continue': 'Continue',
    'modal.no_slots': 'No available slots for this day',

    'relative.today': 'today',
    'relative.tomorrow': 'tomorrow',
    'relative.in_days': 'in {0} days',

    'visit.singular': 'visit',
    'visit.plural': 'visits',

    // Settings / Config
    'settings.title': 'Settings',
    'settings.horarios': 'Schedules',
    'settings.festivos': 'Holidays',
    'settings.bloques': 'Blocks',
    'settings.seasons_empty': 'No seasons',
    'settings.seasons_empty_sub': 'Using default schedule',
    'settings.add_season': 'Add season',
    'settings.edit_season': 'Edit season',
    'settings.season_name': 'Name',
    'settings.season_name_ph': 'Summer 2026',
    'settings.season_start': 'Start',
    'settings.season_end': 'End',
    'settings.season_hours': 'Hours per day',
    'settings.season_morning': 'Morning',
    'settings.season_afternoon': 'Afternoon',
    'settings.season_active': 'Active',
    'settings.season_inactive': 'Inactive',
    'settings.delete_season': 'Delete',
    'settings.delete_season_confirm': 'Delete season?',
    'settings.save_season': 'Save season',
    'settings.saving': 'Saving…',
    'settings.season_saved': 'Season saved',
    'settings.add_holiday': 'Add holiday',
    'settings.holiday_date': 'Date',
    'settings.holiday_name': 'Name',
    'settings.holiday_name_es': 'Name (ES)',
    'settings.holiday_name_en': 'Name (EN)',
    'settings.holiday_empty': 'No holidays',
    'settings.holiday_empty_sub': 'Add holidays for the year',
    'settings.delete_holiday': 'Delete',
    'settings.delete_holiday_confirm': 'Delete holiday?',
    'settings.holiday_saved': 'Holiday added',
    'settings.add_block': 'Add block',
    'settings.block_date': 'Date',
    'settings.block_type': 'Type',
    'settings.block_full_day': 'Full day',
    'settings.block_time_range': 'Time range',
    'settings.block_start': 'From',
    'settings.block_end': 'To',
    'settings.block_reason': 'Reason',
    'settings.block_reason_ph': 'Vacation, doctor, event…',
    'settings.block_empty': 'No blocks',
    'settings.block_empty_sub': 'Block days or time ranges',
    'settings.delete_block': 'Delete',
    'settings.delete_block_confirm': 'Delete block?',
    'settings.block_saved': 'Block created',
    'settings.google_reviews': 'Google Reviews',
    'settings.google_placeholder': 'Google Place ID',
    'settings.google_ph': 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    'settings.google_saved': 'Saved',
    'settings.view_reviews': 'View on Google →',
    'settings.reset_demo': 'Reset demo data',
    'settings.reset_demo_desc': 'Deletes all demo-marked appointments and clients. Real data is not affected.',
    'settings.reset_demo_confirm': 'Reset all demo data? This action cannot be undone.',
    'settings.reset_demo_btn': 'Yes, delete demo data',
    'settings.reset_demo_cancel': 'Cancel',
    'settings.reset_demo_error': 'Error resetting demo data',
    'settings.reset_demo_success': 'Demo data deleted: {0} appointments, {1} clients',
    'settings.push_title': 'Push Notifications',
    'settings.push_desc': 'Receive real-time notifications on your device when new bookings arrive.',
    'settings.push_activate': 'Enable notifications',
    'settings.push_deactivate': 'Disable notifications',
    'settings.push_activated': 'Notifications enabled',
    'settings.push_not_supported': 'Your browser does not support push notifications',
    'settings.push_ios_guide': 'On iPhone: add this website to your Home Screen (Share → Add to Home Screen) to receive notifications.',
    'settings.push_denied': 'Permission denied. Change notification settings in your browser.',
    'settings.push_error': 'Error enabling notifications',

    'admin.registered': '{0} registered',
    'admin.inactive_clients': 'Inactive (30+ days)',
    'admin.logout': 'Logout',
    'admin.delete_client': 'Delete client',
    'admin.delete_confirm': 'Yes, delete',
    'admin.delete_cancel': 'Cancel',
    'admin.delete_warning': 'Past appointments will be kept.',
    'admin.delete_warning_action': 'This action cannot be undone. All client data will be permanently deleted.',
    'admin.delete_success': 'Client deleted',

    // Agenda views
    'agenda.day': 'Day',
    'agenda.week': 'Week',
    'agenda.month': 'Month',
    'agenda.weekly_title': 'Week of {0}',
    'agenda.monthly_title': '{0} {1}',
    'agenda.month_short_0': 'Jan', 'agenda.month_short_1': 'Feb', 'agenda.month_short_2': 'Mar',
    'agenda.month_short_3': 'Apr', 'agenda.month_short_4': 'May', 'agenda.month_short_5': 'Jun',
    'agenda.month_short_6': 'Jul', 'agenda.month_short_7': 'Aug', 'agenda.month_short_8': 'Sep',
    'agenda.month_short_9': 'Oct', 'agenda.month_short_10': 'Nov', 'agenda.month_short_11': 'Dec',
    'agenda.day_short_0': 'Mo', 'agenda.day_short_1': 'Tu', 'agenda.day_short_2': 'We',
    'agenda.day_short_3': 'Th', 'agenda.day_short_4': 'Fr', 'agenda.day_short_5': 'Sa',
    'agenda.day_short_6': 'Su',
    'agenda.prev': '← Prev',
    'agenda.next': 'Next →',
    'agenda.today': 'Today',
    'agenda.no_data': 'No appointments today',
    'agenda.book': 'book',
    'agenda.books': 'books',

    // Notifications
    'notif.title': 'Notifications',
    'notif.empty': 'No new notifications',
    'notif.new_booking': 'New booking from {0}',
    'notif.new_booking_detail': '{0} · {1}',
    'notif.sound_on': 'Sound on',
    'notif.sound_off': 'Sound off',
    'notif.dismiss': 'Dismiss notification',
    'notif.toast_title': 'New booking',

    // Client CRM
    'crm.title': 'Client profile',
    'crm.back': '← Back to clients',
    'crm.info': 'Information',
    'crm.history': 'Visit history',
    'crm.stats': 'Statistics',
    'crm.total_visits': 'Total visits',
    'crm.completed_visits': 'Completed',
    'crm.cancelled_visits': 'Cancelled',
    'crm.total_spent': 'Total spent',
    'crm.service_breakdown': 'Services done',
    'crm.last_visit': 'Last visit',
    'crm.member_since': 'Member since',
    'crm.edit_success': 'Client updated',
    'crm.edit': 'Edit',
    'crm.save': 'Save changes',
    'crm.saving': 'Saving…',
    'crm.no_history': 'No visits yet',
    'crm.notes': 'Notes',
    'crm.notes_optional': 'optional',
    'crm.notes_placeholder': 'e.g. prefers Thursdays, curly hair, responsive by phone…',
    'crm.notes_section': 'Internal notes',
    'crm.save_notes': 'Save note',
    'crm.notes_saved': 'Note saved',
    'crm.client_since': 'Client since',
    'crm.whatsapp': 'Send WhatsApp',
    'crm.whatsapp_msg': 'Hi {0}! I am your barber from Código de Caballeros. I am writing to confirm your upcoming appointment.',

    'error.services': 'Could not load services',
    'error.slots': 'Could not load available times',
    'error.create': 'Error creating the booking',
    'error.not_found': 'Booking not found',
    'error.cancel': 'Could not cancel',
    'error.agenda': 'Could not load agenda',
    'error.clients': 'Could not load clients',
    'error.upcoming': 'Could not load upcoming bookings',
    'error.update': 'Could not update',
    'error.client_detail': 'Could not load client details',
    'error.notifications': 'Could not load notifications',
    'error.blocks': 'Could not load time blocks',
  },
}

// ── Persistence with fallback ──

function _readStorage() {
  try { return localStorage.getItem(LANG_KEY) } catch { return null }
}

function _writeStorage(val) {
  try { localStorage.setItem(LANG_KEY, val) } catch { /* no-op */ }
}

function _detectBrowserLang() {
  const nav = navigator
  const candidates = [
    ...(nav.languages || []),
    nav.language || '',
    nav.userLanguage || '',
  ].filter(Boolean)
  for (const l of candidates) {
    if (l.startsWith('en')) return 'en'
  }
  return 'es'
}

// ── Public API ──

export function getLang() {
  if (_memoryLang) return _memoryLang
  const stored = _readStorage()
  if (stored === 'es' || stored === 'en') {
    _memoryLang = stored
    return stored
  }
  const detected = _detectBrowserLang()
  _memoryLang = detected
  _writeStorage(detected)
  return detected
}

export function setLang(lang) {
  _memoryLang = lang
  _writeStorage(lang)
}

export function t(key, ...args) {
  const lang = getLang()
  let text = dict[lang]?.[key] ?? dict['es']?.[key] ?? key
  args.forEach((arg, i) => {
    text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg))
  })
  return text
}

export function locale() {
  return getLang() === 'en' ? 'en-US' : 'es-ES'
}
