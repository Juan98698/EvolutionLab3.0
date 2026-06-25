import { useState, useEffect, useMemo } from 'react';
import { 
  SplitType, 
  distributeSetsToSessions, 
  GeneratedSession, 
  MUSCLES
} from '../../lib/sessionDistributor';
import { getThresholdsForMuscleGroup, AthleteLevel } from '../../lib/volumeThresholds';

interface Props {
  onClose: () => void;
  onApply: (sessions: GeneratedSession[]) => void;
  athleteLevel?: AthleteLevel;
}

export function VolumeDistributorWizard({ onClose, onApply, athleteLevel = 'intermedio' }: Props) {
  const [splitType, setSplitType] = useState<SplitType>('upper_lower');
  const [trainingDays, setTrainingDays] = useState(4);
  const [muscleVolume, setMuscleVolume] = useState<Record<string, number>>({});
  
  // Para estilo libre
  const [customDays, setCustomDays] = useState<Array<{name: string, muscles: string[]}>>([
    { name: 'Día 1', muscles: [] }
  ]);

  // Qué músculos se trabajan en el split actual
  const activeMuscles = useMemo(() => {
    if (splitType === 'estilo_libre') {
      const all = new Set<string>();
      customDays.forEach(d => d.muscles.forEach(m => all.add(m)));
      return Array.from(all);
    }
    
    
    // Simplificación: Para los splits predefinidos, la mayoría usan todo el cuerpo.
    // Solo devolvemos todos los MUSCLES si no es estilo libre.
    return MUSCLES;
  }, [splitType, customDays, trainingDays]);

  // Inicializar volumen al MAV por defecto
  useEffect(() => {
    const initialVolume: Record<string, number> = {};
    activeMuscles.forEach(muscle => {
      const thresholds = getThresholdsForMuscleGroup(muscle, athleteLevel);
      initialVolume[muscle] = thresholds.mavMin;
    });
    setMuscleVolume(initialVolume);
  }, [splitType, athleteLevel, activeMuscles.length]); // se rehace al cambiar split o nivel

  const handleVolumeChange = (muscle: string, value: number) => {
    setMuscleVolume(prev => ({ ...prev, [muscle]: value }));
  };

  const generatedSessions = useMemo(() => {
    const weeklyVolume = Object.entries(muscleVolume).map(([muscleGroup, plannedSets]) => ({
      muscleGroup,
      plannedSets
    }));

    return distributeSetsToSessions({
      trainingDays,
      splitType,
      weeklyVolume,
      customDays: splitType === 'estilo_libre' ? customDays : undefined
    });
  }, [splitType, trainingDays, muscleVolume, customDays]);

  const totalSets = Object.values(muscleVolume).reduce((a, b) => a + b, 0);

  // Funciones para estilo libre
  const toggleMuscleInCustomDay = (dayIndex: number, muscle: string) => {
    const newDays = [...customDays];
    const day = newDays[dayIndex];
    if (day.muscles.includes(muscle)) {
      day.muscles = day.muscles.filter(m => m !== muscle);
    } else {
      day.muscles.push(muscle);
    }
    setCustomDays(newDays);
  };

  const addCustomDay = () => {
    setCustomDays([...customDays, { name: `Día ${customDays.length + 1}`, muscles: [] }]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* PANEL IZQUIERDO: Configuración */}
        <div className="w-full md:w-[45%] flex flex-col border-r border-[#333] bg-[#151515] overflow-y-auto">
          <div className="p-6 border-b border-[#333] sticky top-0 bg-[#151515] z-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-xl">⚡</span> Asistente de Distribución
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Nivel actual: <strong className="text-indigo-400 uppercase">{athleteLevel}</strong>
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Split Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Split preferido</label>
              <select 
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as SplitType)}
                className="w-full bg-[#222] border border-[#444] rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500"
              >
                <option value="upper_lower">Upper / Lower (Torso/Pierna)</option>
                <option value="push_pull_legs">Push / Pull / Legs (Empuje/Tirón/Pierna)</option>
                <option value="full_body">Full Body (Cuerpo Completo)</option>
                <option value="arnold_split">Arnold Split (PechoEspalda/Pierna/Brazo)</option>
                <option value="bro_split">Weider / Bro Split (1 músculo por día)</option>
                <option value="estilo_libre">Estilo Libre (Personalizado)</option>
              </select>
            </div>

            {/* Días por semana */}
            {splitType !== 'estilo_libre' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-300">Días por semana</label>
                  <span className="text-white font-bold">{trainingDays} días</span>
                </div>
                <input 
                  type="range" 
                  min={2} max={6} step={1}
                  value={trainingDays}
                  onChange={(e) => setTrainingDays(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}

            {/* Constructor Estilo Libre */}
            {splitType === 'estilo_libre' && (
              <div className="space-y-4 border border-[#444] rounded-lg p-4 bg-[#1E1E1E]">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Días Personalizados</h3>
                {customDays.map((day, idx) => (
                  <div key={idx} className="bg-[#222] border border-[#333] rounded p-3">
                    <input 
                      type="text" 
                      value={day.name}
                      onChange={e => {
                        const newDays = [...customDays];
                        newDays[idx].name = e.target.value;
                        setCustomDays(newDays);
                      }}
                      className="bg-transparent text-white font-bold outline-none mb-2 w-full"
                    />
                    <div className="flex flex-wrap gap-2">
                      {MUSCLES.map(m => {
                        const isSelected = day.muscles.includes(m);
                        return (
                          <button
                            key={m}
                            onClick={() => toggleMuscleInCustomDay(idx, m)}
                            className={`px-2 py-1 text-xs rounded border ${
                              isSelected 
                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                                : 'bg-[#151515] border-[#444] text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={addCustomDay}
                  className="w-full py-2 bg-[#2A2A2A] hover:bg-[#333] text-gray-300 rounded text-sm font-medium transition-colors"
                >
                  + Añadir Día
                </button>
              </div>
            )}

            <hr className="border-[#333]" />

            {/* Sliders de Volumen (Solo mostrar si hay músculos seleccionados en estilo_libre) */}
            {(splitType !== 'estilo_libre' || activeMuscles.length > 0) && (
              <div>
                <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Ajuste de Volumen Semanal</h3>
                <div className="space-y-6">
                  {activeMuscles.map(muscle => {
                    const threshold = getThresholdsForMuscleGroup(muscle, athleteLevel);
                    const val = muscleVolume[muscle] || 0;
                    
                    // Calcular colores según el valor actual
                    let statusColor = '#483D8B'; // MEV color
                    if (val < threshold.mev) statusColor = '#666'; // Sub-óptimo
                    else if (val >= threshold.mavMin && val <= threshold.mavMax) statusColor = '#006400'; // MAV óptimo
                    else if (val >= threshold.mrv) statusColor = '#8B0000'; // Peligro
                    else statusColor = '#B8860B'; // Warning (entre MAV y MRV)

                    return (
                      <div key={muscle} className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-200">{muscle}</span>
                          <span className="text-sm font-bold" style={{ color: statusColor }}>
                            {val} series
                          </span>
                        </div>
                        
                        {/* Custom Slider with Markers */}
                        <div className="relative pt-4 pb-2">
                          <input 
                            type="range" 
                            min={0} max={45} step={1}
                            value={val}
                            onChange={(e) => handleVolumeChange(muscle, Number(e.target.value))}
                            className="w-full absolute top-4 left-0 z-10 opacity-0 cursor-pointer"
                            style={{ height: '6px' }}
                          />
                          {/* Custom track */}
                          <div className="w-full h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-200" 
                              style={{ width: `${(val / 45) * 100}%`, backgroundColor: statusColor }}
                            />
                          </div>
                          
                          {/* Markers */}
                          <div className="absolute top-0 w-full h-full pointer-events-none">
                            {/* MEV Marker */}
                            <div className="absolute flex flex-col items-center" style={{ left: `${(threshold.mev / 45) * 100}%`, transform: 'translateX(-50%)' }}>
                              <span className="text-[9px] font-bold text-[#E6E6FA] mb-0.5">MEV</span>
                              <div className="w-0.5 h-3 bg-[#E6E6FA]" />
                            </div>
                            {/* MAV Min Marker */}
                            <div className="absolute flex flex-col items-center" style={{ left: `${(threshold.mavMin / 45) * 100}%`, transform: 'translateX(-50%)' }}>
                              <span className="text-[9px] font-bold text-[#E0FFF0] mb-0.5">MAV</span>
                              <div className="w-0.5 h-3 bg-[#E0FFF0]" />
                            </div>
                            {/* MRV Marker */}
                            <div className="absolute flex flex-col items-center" style={{ left: `${(threshold.mrv / 45) * 100}%`, transform: 'translateX(-50%)' }}>
                              <span className="text-[9px] font-bold text-[#FFE4E1] mb-0.5">MRV</span>
                              <div className="w-0.5 h-3 bg-[#FFE4E1]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Previsualización */}
        <div className="w-full md:w-[55%] flex flex-col bg-[#1A1A1A] relative">
          <div className="p-6 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A] z-10">
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Distribución Generada</h3>
              <p className="text-xs text-gray-500 mt-1">{totalSets} series totales en la semana</p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-[#333] transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-[#1A1A1A]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {generatedSessions.map(session => {
                const sessionSets = session.muscleTargets.reduce((a, b) => a + b.plannedSets, 0);
                
                return (
                  <div key={session.id} className="bg-[#222] border border-[#333] rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-[#2A2A2A] px-4 py-3 border-b border-[#333] flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{session.label}</span>
                      <span className="text-xs font-medium bg-[#151515] text-gray-400 px-2 py-1 rounded">
                        {sessionSets} series
                      </span>
                    </div>
                    
                    <div className="p-0">
                      {session.muscleTargets.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500 italic">
                          Día de descanso o sin volumen asignado.
                        </div>
                      )}
                      {session.muscleTargets.map((target, idx) => (
                        <div 
                          key={target.muscleGroup} 
                          className={`flex justify-between items-center px-4 py-3 text-sm
                            ${idx !== session.muscleTargets.length - 1 ? 'border-b border-[#333]/50' : ''}
                          `}
                        >
                          <span className="text-gray-300">{target.muscleGroup}</span>
                          <span className="font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">
                            {target.plannedSets} series
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 border-t border-[#333] bg-[#1A1A1A] sticky bottom-0">
            <button 
              onClick={() => onApply(generatedSessions)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Aplicar Esqueleto al Plan
            </button>
            <p className="text-xs text-center text-gray-500 mt-3">
              Esto creará los días vacíos con las series asignadas listas para que elijas los ejercicios.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
