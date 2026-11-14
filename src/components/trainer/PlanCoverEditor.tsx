import { InfoTooltip } from '../common/InfoTooltip';

const fields = [
  { key: 'userName', label: 'Nombre del atleta', type: 'text' },
  { key: 'userGoal', label: 'Objetivo principal', type: 'text' },
  { key: 'startDate', label: 'Fecha de inicio', type: 'date' },
  { key: 'planVigenciaPlan', label: 'Vigencia plan (días)', type: 'number', help: 'Número de días que el plan estará activo. Un valor habitual es 28–30 días.' },
  { key: 'trainerName', label: 'Nombre entrenador', type: 'text' },
  { key: 'whatsappLink', label: 'WhatsApp entrenador', type: 'text', placeholder: 'https://wa.me/…' },
  { key: 'instagramLink', label: 'Instagram entrenador', type: 'text', placeholder: 'https://instagram.com/…' },
] as const;

export function PlanCoverEditor({ portada, onChange }: { portada: Record<string, string>; onChange: (field: string, value: string) => void }) {
  return <section className="studio-plan-section" aria-labelledby="plan-cover-heading">
    <h2 id="plan-cover-heading">Información del plan</h2>
    <p>Define el objetivo y los datos que acompañarán al atleta.</p>
    <div className="studio-form-fields">
      {fields.map(field => <div key={field.key}>
        <label htmlFor={`portada-${field.key}`}>{field.label}{'help' in field && <InfoTooltip title="Vigencia del Plan" body={field.help} />}</label>
        <input id={`portada-${field.key}`} type={field.type} value={portada[field.key] ?? ''} onChange={event => onChange(field.key, event.target.value)} placeholder={'placeholder' in field ? field.placeholder : undefined} min={field.type === 'number' ? 1 : undefined} />
      </div>)}
    </div>
    <label className="studio-plan-note" htmlFor="portada-globalNote">Indicaciones generales del entrenador</label>
    <textarea id="portada-globalNote" rows={3} value={portada.globalNote ?? ''} onChange={event => onChange('globalNote', event.target.value)} />
  </section>;
}
