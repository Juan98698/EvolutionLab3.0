/** The same server-owned catalog is used for checkout and payment verification. */
export const PLAN_CURRENCY = 'COP';
export const BILLING_PLANS = {
  premium: { amount: 19900, name: 'Solo Lifter Pro', description: 'Sugerencias de progresión para atletas autónomos.' },
  iniciacion: { amount: 17900, name: 'Plan Iniciación (Coach)', description: 'Gestión de hasta 2 atletas vinculados.' },
  intermedio: { amount: 59900, name: 'Plan Intermedio (Coach)', description: 'Gestión de hasta 10 atletas vinculados.' },
  profesional: { amount: 299000, name: 'Plan Profesional (Coach)', description: 'Gestión de atletas ilimitados.' },
} as const;

export function isBillingPlan(value: unknown): value is keyof typeof BILLING_PLANS {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BILLING_PLANS, value);
}
