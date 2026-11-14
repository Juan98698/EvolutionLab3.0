import { useState } from 'react';

type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password'; autoComplete?: string; onBlur?: () => void;
  error?: string; help?: string; required?: boolean; inputMode?: 'numeric'; maxLength?: number;
};
export function AuthField({ id, label, value, onChange, type = 'text', autoComplete, onBlur, error, help, required = true, inputMode, maxLength }: Props) {
  const [visible, setVisible] = useState(false);
  const description = error || help;
  return <div className="studio-field">
    <label htmlFor={id}>{label}</label>
    <div className="studio-password-field">
      <input id={id} type={type === 'password' && visible ? 'text' : type} value={value} onChange={event => onChange(event.target.value)}
        onBlur={onBlur} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} required={required} aria-invalid={!!error} aria-describedby={description ? `${id}-help` : undefined} />
      {type === 'password' && <button type="button" aria-label={id.includes('confirm') ? 'Mostrar u ocultar confirmación de contraseña' : 'Mostrar u ocultar contraseña'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button>}
    </div>
    {(description || type === 'email' || id.toLowerCase().includes('confirm')) && <p id={`${id}-help`} className={error ? 'studio-field-error' : 'studio-field-help'}>{description || '\u00a0'}</p>}
  </div>;
}
