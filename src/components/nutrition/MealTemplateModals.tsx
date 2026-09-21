import React, { useState, useEffect } from 'react';
import { Meal, MealTemplate } from '../../types/nutrition.types';
import { getMealTemplates, saveMealTemplate, deleteMealTemplate } from '../../lib/nutritionTemplates';

interface SaveMealTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  meal: Meal;
  onSaveSuccess: (template: MealTemplate) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SaveMealTemplateModal: React.FC<SaveMealTemplateModalProps> = ({
  isOpen,
  onClose,
  trainerId,
  meal,
  onSaveSuccess,
  showToast,
}) => {
  const [nombre, setNombre] = useState(meal.nombre || 'Receta Guardada');
  const [categoria, setCategoria] = useState(meal.nombre.includes('Desayuno') ? 'Desayuno' : meal.nombre.includes('Almuerzo') ? 'Almuerzo' : meal.nombre.includes('Cena') ? 'Cena' : 'Snack');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      showToast?.('Ingresa un nombre para la receta/comida.', 'error');
      return;
    }
    if (!meal.foods || meal.foods.length === 0) {
      showToast?.('No se puede guardar una comida vacía.', 'error');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMealTemplate({
        entrenador_id: trainerId || 'default',
        nombre: nombre.trim(),
        categoria,
        horario_sugerido: meal.horario || '08:00',
        foods: meal.foods,
      });

      showToast?.(`✅ Receta "${saved.nombre}" guardada correctamente.`, 'success');
      onSaveSuccess(saved);
      onClose();
    } catch (err: any) {
      showToast?.('Error al guardar receta: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalKcal = meal.foods.reduce((acc, f) => acc + (f.calorias || 0), 0);
  const totalP = meal.foods.reduce((acc, f) => acc + (f.proteina || 0), 0);
  const totalC = meal.foods.reduce((acc, f) => acc + (f.carbohidratos || 0), 0);
  const totalG = meal.foods.reduce((acc, f) => acc + (f.grasa || 0), 0);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop
    <div
      className="nutrition-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '440px',
          padding: '20px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
            💾 GUARDAR COMIDA COMO RECETA
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.6)', fontSize: '20px', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
              Nombre de la Receta *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Desayuno Anabólico Avena + Whey"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#121829',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#00d4ff',
                padding: '10px 12px',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              <option value="Desayuno">Desayuno</option>
              <option value="Media Mañana">Media Mañana</option>
              <option value="Almuerzo">Almuerzo</option>
              <option value="Merienda">Merienda</option>
              <option value="Cena">Cena</option>
              <option value="Pre-Entreno">Pre-Entreno</option>
              <option value="Post-Entreno">Post-Entreno</option>
              <option value="Snack">Snack General</option>
            </select>
          </div>

          <div
            style={{
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <div>Alimentos incluidos ({meal.foods.length}):</div>
            <ul style={{ margin: '6px 0 8px 0', paddingLeft: '18px', fontSize: '11px', color: '#fff' }}>
              {meal.foods.map((f) => (
                <li key={f.id}>
                  {f.nombre}: <strong>{f.cantidad} {f.unidad}</strong> ({f.calorias} kcal)
                </li>
              ))}
            </ul>
            <div style={{ color: '#00d4ff', fontWeight: 700 }}>
              Total: {totalKcal} kcal • P: {totalP.toFixed(1)}g | C: {totalC.toFixed(1)}g | G: {totalG.toFixed(1)}g
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                border: 'none',
                color: '#000000',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {saving ? 'Guardando...' : '💾 GUARDAR RECETA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   CARGAR COMIDA / RECETA GUARDADA
   ========================================================================= */

interface LoadMealTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  onSelectTemplate: (template: MealTemplate, mode: 'replace' | 'append') => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const LoadMealTemplateModal: React.FC<LoadMealTemplateModalProps> = ({
  isOpen,
  onClose,
  trainerId,
  onSelectTemplate,
  showToast,
}) => {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('Todos');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getMealTemplates(trainerId)
        .then((list) => setTemplates(list))
        .finally(() => setLoading(false));
    }
  }, [isOpen, trainerId]);

  if (!isOpen) return null;

  const handleDelete = async (mId: string, mNombre: string) => {
    if (!window.confirm(`¿Eliminar la receta "${mNombre}"?`)) return;
    await deleteMealTemplate(mId, trainerId);
    setTemplates((prev) => prev.filter((t) => t.id !== mId));
    showToast?.('Receta eliminada.', 'info');
  };

  const filtered = filterCat === 'Todos'
    ? templates
    : templates.filter((t) => t.categoria === filterCat);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop
    <div
      className="nutrition-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          color: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
              📋 INSERTAR RECETA GUARDADA
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Inserta combinaciones preparadas de alimentos en esta comida con un solo clic.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.6)', fontSize: '20px', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Filter categories */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {['Todos', 'Desayuno', 'Almuerzo', 'Cena', 'Snack'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCat(cat)}
              style={{
                background: filterCat === cat ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: filterCat === cat ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                color: filterCat === cat ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Cargando recetas...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              No hay recetas guardadas en esta categoría.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map((tpl) => {
                const totalKcal = (tpl.foods || []).reduce((acc, f) => acc + (f.calorias || 0), 0);
                const totalP = (tpl.foods || []).reduce((acc, f) => acc + (f.proteina || 0), 0);
                const totalC = (tpl.foods || []).reduce((acc, f) => acc + (f.carbohidratos || 0), 0);
                const totalG = (tpl.foods || []).reduce((acc, f) => acc + (f.grasa || 0), 0);

                return (
                  <div
                    key={tpl.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                            {tpl.nombre}
                          </span>
                          {tpl.categoria && (
                            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff' }}>
                              {tpl.categoria}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
                          {(tpl.foods || []).map((f) => `${f.nombre} (${f.cantidad}${f.unidad})`).join(', ')}
                        </div>
                      </div>

                      {tpl.entrenador_id !== 'system' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(tpl.id, tpl.nombre)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                          title="Eliminar receta"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#00d4ff', fontWeight: 600 }}>
                        {totalKcal} kcal • P: {totalP.toFixed(1)}g | C: {totalC.toFixed(1)}g | G: {totalG.toFixed(1)}g
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTemplate(tpl, 'append');
                            onClose();
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Añade estos alimentos a los que ya tiene la comida"
                        >
                          + Añadir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTemplate(tpl, 'replace');
                            onClose();
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                            border: 'none',
                            color: '#000',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: "'Orbitron', sans-serif",
                          }}
                          title="Reemplaza los alimentos de la comida por los de esta receta"
                        >
                          Reemplazar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
