import React from 'react';
import { Profile } from '../../../types/database.types';

interface TrainerClientsTabProps {
  searchQuery: string; setSearchQuery: (val: string) => void;
  filterModalidad: string; setFilterModalidad: (val: string) => void;
  setRegisterOpen: (val: boolean) => void; loading: boolean;
  filteredClientes: Profile[]; updatingVigenciaId: string | null;
  handleVigenciaLocalChange: (id: string, value: string) => void;
  handleVigenciaSave: (id: string, value: number) => void;
  clientesRachas: Record<string, { actual: number; maxima: number }>;
  clientesLogros: Record<string, { titulo: string; icono: string; tipo: string }[]>;
  navigate: (path: string) => void;
  handleOpenRegisterSessionModal: (atleta: Profile) => void;
  handleOpenEvolutionModal: (atleta: Profile) => void;
  handleOpenAnthropometryModal?: (atleta: Profile) => void;
  handleOpenNutritionModal?: (atleta: Profile) => void;
  trainerSubscription?: { plan: string; estado: string; expira_at: string | null } | null;
  trainerProfile?: Profile | null;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const TrainerClientsTab: React.FC<TrainerClientsTabProps> = (props) => {
  const paid = Boolean((props.trainerSubscription?.plan && props.trainerSubscription.plan !== 'free') || (props.trainerProfile?.suscripcion_plan && props.trainerProfile.suscripcion_plan !== 'free'));
  const premium = (action: (() => void) | undefined) => {
    if (paid) action?.();
    else props.showToast?.('Esta herramienta requiere un plan de entrenador de pago.', 'info');
  };
  return <section aria-labelledby="studio-team-title">
    <div className="studio-client-tools">
      <div><h2 id="studio-team-title">Tus atletas</h2><div className="studio-client-filters">
        <label>Buscar atleta<input type="search" placeholder="Buscar por nombre o correo..." value={props.searchQuery} onChange={e => props.setSearchQuery(e.target.value)} /></label>
        <label>Modalidad<select value={props.filterModalidad} onChange={e => props.setFilterModalidad(e.target.value)}><option value="all">Todas las modalidades</option><option value="remoto">Remoto</option><option value="presencial">Presencial</option></select></label>
      </div></div>
      <button className="btn btn-primary" onClick={() => props.setRegisterOpen(true)}>Registrar nuevo atleta</button>
    </div>
    {props.loading ? <p className="studio-empty" role="status">Cargando atletas vinculados...</p> : !props.filteredClientes.length ? <div className="studio-empty"><h3>Tu equipo empieza aquí</h3><p>{props.searchQuery ? 'No se encontraron atletas con esa búsqueda.' : 'Registra un atleta o envía una invitación para empezar a planificar.'}</p></div> :
      <div className="studio-client-list">{props.filteredClientes.map(athlete => <article key={athlete.id} className="studio-client-row" aria-label={`Atleta ${athlete.nombre}`}>
        <div className="studio-client-identity"><span className="studio-client-avatar" aria-hidden="true">{athlete.nombre.split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div><h3>{athlete.nombre}</h3><p>{athlete.email}</p></div></div>
        <p className="studio-client-meta">{athlete.objetivo || 'Objetivo por definir'}<br />{athlete.modalidad === 'presencial' ? 'Presencial' : 'Remoto'}</p>
        <button className="btn btn-primary" onClick={() => props.navigate(`/trainer/plan/${athlete.id}`)}>Planificar <span aria-hidden="true">→</span></button>
        <details className="studio-details"><summary>Seguimiento y herramientas</summary>
          <div className="studio-client-details"><span>Inicio: {athlete.fecha_inicio ? athlete.fecha_inicio.split('-').reverse().join('/') : 'Sin fecha'}</span>
            <label>Vigencia (días)<input type="number" min="1" max="9999" aria-label={`Vigencia de ${athlete.nombre}`} disabled={props.updatingVigenciaId === athlete.id} value={athlete.vigencia_dias ?? ''} onChange={e => props.handleVigenciaLocalChange(athlete.id, e.target.value)} onBlur={e => { const value = Number(e.target.value); if (value >= 1 && value <= 9999) props.handleVigenciaSave(athlete.id, value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
            <span>Racha: {props.clientesRachas[athlete.id]?.actual || 0} días</span><span>Logros: {props.clientesLogros[athlete.id]?.length || 0}</span>
          </div><div className="studio-client-actions">
            <button className="btn" onClick={() => props.handleOpenRegisterSessionModal(athlete)}>Registrar sesión</button>
            <button className="btn" onClick={() => props.handleOpenEvolutionModal(athlete)}>Evolución / PDF</button>
            <button className="btn" onClick={() => props.navigate('/trainer/config')}>Reglas</button>
            {props.handleOpenAnthropometryModal && <button className="btn" onClick={() => premium(() => props.handleOpenAnthropometryModal?.(athlete))}>Antropometría y macros{!paid && ' · Pro'}</button>}
            {props.handleOpenNutritionModal && <button className="btn" onClick={() => premium(() => props.handleOpenNutritionModal?.(athlete))}>Nutrición{!paid && ' · Pro'}</button>}
          </div>
        </details>
      </article>)}</div>}
  </section>;
};
export default TrainerClientsTab;
