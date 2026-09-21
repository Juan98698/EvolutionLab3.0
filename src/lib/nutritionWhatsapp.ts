import { NutritionPlan, DayOfWeek } from '../types/nutrition.types';

const DAY_LABELS: Record<DayOfWeek, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/**
 * Formatea el plan nutricional de un día específico en texto para WhatsApp
 */
export function formatDayForWhatsapp(
  plan: NutritionPlan,
  dayKey: DayOfWeek,
  atletaNombre: string,
  trainerNombre?: string
): string {
  const day = plan.datos_plan?.days?.[dayKey];
  const dayLabel = DAY_LABELS[dayKey] || dayKey;
  const tKcal = plan.target_calorias || 2000;
  const tP = plan.target_proteina_g || 140;
  const tC = plan.target_carbohidratos_g || 220;
  const tG = plan.target_grasa_g || 60;

  let msg = `🥗 *PLAN NUTRICIONAL — EVOLUTION LAB*\n`;
  msg += `👤 *Atleta:* ${atletaNombre}\n`;
  if (trainerNombre) {
    msg += `🏋️ *Entrenador:* ${trainerNombre}\n`;
  }
  msg += `📅 *Día:* ${dayLabel.toUpperCase()}\n`;
  msg += `🎯 *Meta Diaria:* ${tKcal} kcal | 🥩 P: ${tP}g | 🌾 C: ${tC}g | 🥑 G: ${tG}g\n`;
  msg += `─────────────────────────\n\n`;

  if (!day || !day.meals || day.meals.length === 0) {
    msg += `_No hay comidas asignadas para este día._\n`;
  } else {
    let dayTotalKcal = 0;
    let dayTotalP = 0;
    let dayTotalC = 0;
    let dayTotalG = 0;

    day.meals.forEach((meal, idx) => {
      const mealKcal = meal.foods.reduce((acc, f) => acc + (f.calorias || 0), 0);
      const mealP = meal.foods.reduce((acc, f) => acc + (f.proteina || 0), 0);
      const mealC = meal.foods.reduce((acc, f) => acc + (f.carbohidratos || 0), 0);
      const mealG = meal.foods.reduce((acc, f) => acc + (f.grasa || 0), 0);

      dayTotalKcal += mealKcal;
      dayTotalP += mealP;
      dayTotalC += mealC;
      dayTotalG += mealG;

      const timeStr = meal.horario ? ` (${meal.horario})` : '';
      msg += `🍴 *${idx + 1}. ${meal.nombre.toUpperCase()}*${timeStr}\n`;

      if (!meal.foods || meal.foods.length === 0) {
        msg += `   _Sin alimentos asignados_\n`;
      } else {
        meal.foods.forEach((f) => {
          msg += `   • ${f.nombre}: *${f.cantidad} ${f.unidad}* (${f.calorias} kcal)\n`;
        });
      }

      msg += `   👉 _Subtotal: ${mealKcal} kcal | P: ${mealP.toFixed(1)}g | C: ${mealC.toFixed(1)}g | G: ${mealG.toFixed(1)}g_\n\n`;
    });

    msg += `─────────────────────────\n`;
    msg += `📊 *TOTAL DEL DÍA:* ${dayTotalKcal} kcal\n`;
    msg += `🥩 Proteína: ${dayTotalP.toFixed(1)}g / ${tP}g\n`;
    msg += `🌾 Carbohidratos: ${dayTotalC.toFixed(1)}g / ${tC}g\n`;
    msg += `🥑 Grasas: ${dayTotalG.toFixed(1)}g / ${tG}g\n\n`;
  }

  if (plan.recomendaciones) {
    msg += `💡 *Recomendaciones:* ${plan.recomendaciones}\n\n`;
  }

  msg += `💧 _Recuerda consumir abundante agua durante el día y registrar tus comidas en EvolutionLab 3.0._`;

  return msg;
}

/**
 * Abre la app o web de WhatsApp con el texto preparado
 */
export function sharePlanViaWhatsapp(
  plan: NutritionPlan,
  dayKey: DayOfWeek,
  atletaNombre: string,
  trainerNombre?: string
): { success: boolean; text: string } {
  const text = formatDayForWhatsapp(plan, dayKey, atletaNombre, trainerNombre);
  const encoded = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?text=${encoded}`;

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return { success: true, text };
}
