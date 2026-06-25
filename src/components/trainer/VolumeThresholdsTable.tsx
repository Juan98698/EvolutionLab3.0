import { useState } from 'react';
import { 
  THRESHOLDS_PRINCIPIANTE, 
  THRESHOLDS_INTERMEDIO, 
  THRESHOLDS_AVANZADO,
  AthleteLevel
} from '../../lib/volumeThresholds';

interface Props {
  onClose: () => void;
}

export function VolumeThresholdsTable({ onClose }: Props) {
  const [activeLevel, setActiveLevel] = useState<AthleteLevel>('intermedio');

  const getThresholds = () => {
    switch (activeLevel) {
      case 'principiante': return THRESHOLDS_PRINCIPIANTE;
      case 'avanzado': return THRESHOLDS_AVANZADO;
      case 'intermedio':
      default: return THRESHOLDS_INTERMEDIO;
    }
  };

  const thresholds = getThresholds();

  const muscleCategories = [
    { name: 'EMPUJE', muscles: ['Pecho', 'Hombros', 'Tríceps'] },
    { name: 'TIRÓN', muscles: ['Espalda', 'Bíceps', 'Trapecio', 'Deltoides posterior'] },
    { name: 'PIERNAS', muscles: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas'] },
    { name: 'CORE', muscles: ['Core', 'Lumbares'] }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
      <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#333]">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-xl">📊</span> Umbrales de Volumen (MEV / MAV / MRV)
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Guía de hipertrofia basada en Renaissance Periodization (Dr. Mike Israetel)
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 bg-[#2A2A2A] rounded-lg hover:bg-[#333]"
          >
            ✕
          </button>
        </div>

        {/* Level Tabs */}
        <div className="p-6 pb-0">
          <div className="flex gap-2">
            {(['principiante', 'intermedio', 'avanzado'] as AthleteLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setActiveLevel(level)}
                className={`px-5 py-2.5 rounded-t-lg font-medium transition-all text-sm uppercase tracking-wider
                  ${activeLevel === level 
                    ? 'bg-[#2A2A2A] text-white border-t-2 border-l border-r border-[#444] border-t-indigo-500 shadow-[0_-4px_10px_-4px_rgba(99,102,241,0.3)]' 
                    : 'bg-[#151515] text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="bg-[#2A2A2A] p-4 rounded-b-lg rounded-tr-lg border border-[#444] border-t-0 flex flex-wrap gap-6 items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-[#E6E6FA] text-[#483D8B] px-2.5 py-0.5 rounded font-bold text-xs">MEV</span>
              <span className="text-gray-300">Mínimo efectivo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#E0FFF0] text-[#006400] px-2.5 py-0.5 rounded font-bold text-xs">MAV</span>
              <span className="text-gray-300">Máximo adaptativo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE4E1] text-[#8B0000] px-2.5 py-0.5 rounded font-bold text-xs">MRV</span>
              <span className="text-gray-300">Máximo recuperable</span>
            </div>
            <div className="ml-auto text-gray-400 text-xs uppercase tracking-wider">
              Series directas / semana
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="bg-[#1E1E1E] border border-[#333] rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-[#333] bg-[#222] font-semibold text-gray-400 text-sm">
              <div className="col-span-1">Grupo muscular</div>
              <div className="text-center">MEV</div>
              <div className="text-center">MAV</div>
              <div className="text-center">MRV</div>
            </div>

            {/* Table Body */}
            {muscleCategories.map(category => (
              <div key={category.name}>
                {/* Category Header */}
                <div className="bg-[#151515] p-2 text-center text-xs font-bold text-gray-500 tracking-[0.2em]">
                  {category.name}
                </div>
                
                {/* Rows */}
                {category.muscles.map(muscle => {
                  // Fallback para músculos que quizás no estén en thresholds exactos
                  const data = thresholds[muscle] || thresholds['General'];
                  if (!data) return null;

                  return (
                    <div key={muscle} className="grid grid-cols-4 gap-4 p-4 border-b border-[#333] hover:bg-[#252525] transition-colors items-center">
                      <div className="col-span-1 font-semibold text-gray-200">
                        {muscle}
                      </div>
                      
                      <div className="text-center">
                        <span className="bg-[#E6E6FA] text-[#483D8B] px-3 py-1 rounded-md font-medium text-sm">
                          {data.mev} series
                        </span>
                      </div>
                      
                      <div className="text-center">
                        <span className="bg-[#E0FFF0] text-[#006400] px-3 py-1 rounded-md font-medium text-sm">
                          {data.mavMin}-{data.mavMax} series
                        </span>
                      </div>
                      
                      <div className="text-center">
                        <span className="bg-[#FFE4E1] text-[#8B0000] px-3 py-1 rounded-md font-medium text-sm">
                          {data.mrv} series
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#151515] border-t border-[#333] text-xs text-gray-500 text-center">
          <p>Rangos basados en Renaissance Periodization (Israetel et al.). Son puntos de partida: la respuesta individual varía según genética, nutrición, sueño y estrés acumulado. Ajusta siempre según señales de recuperación del atleta.</p>
        </div>
      </div>
    </div>
  );
}
