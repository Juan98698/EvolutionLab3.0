/**
 * Catálogo de planes de pago. Lo usan tanto la creación de la preferencia de
 * MercadoPago como el webhook, que verifica que el pago aprobado corresponda
 * al precio y la moneda del plan antes de activarlo.
 */
export const PLAN_CURRENCY = 'COP';

export const PLANS: Record<string, { amount: number; name: string; description: string }> = {
  premium: {
    amount: 19900,
    name: 'Solo Lifter Pro',
    description: 'Sugerencias de Smart Coach y reglas avanzadas para atletas autónomos.',
  },
  iniciacion: {
    amount: 17900,
    name: 'Plan Iniciación (Coach)',
    description: 'Gestión de hasta 2 atletas vinculados.',
  },
  intermedio: {
    amount: 59900,
    name: 'Plan Intermedio (Coach)',
    description: 'Gestión de hasta 10 atletas vinculados.',
  },
  profesional: {
    amount: 299000,
    name: 'Plan Profesional (Coach)',
    description: 'Gestión de atletas ilimitados.',
  },
};
