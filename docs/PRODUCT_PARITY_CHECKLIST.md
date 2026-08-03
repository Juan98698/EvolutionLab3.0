# EvolutionLab 3.0 — Product Parity Checklist (Definition of Done)

Este documento establece los criterios obligatorios de **Paridad de Producto** para el desarrollo de nuevas características en EvolutionLab 3.0.

---

## 🎯 Regla Fundamental
> **"Ninguna funcionalidad de planificación o periodización debe nacer como exclusiva del Entrenador a menos que sea intrínsecamente un flujo de gestión multicliente."**

---

## 📋 Checklist de Paridad Obligatorio antes de Cerrar una Característica

Antes de marcar cualquier característica o refactor como `DONE`, el desarrollador/agente debe auditar las siguientes 4 preguntas:

- [ ] **1. Evaluar el Rol del Atleta Autodidacta**:
  * ¿Esta característica (ej. Plantillas, Fusión de Protocolos, Calculadora 1RM, Volúmenes MEV/MAV/MRV) es útil para un atleta independiente que gestiona su propio plan en `AthleteDashboard`?

- [ ] **2. Integración en `AthleteDashboard.tsx`**:
  * Si la respuesta a la pregunta 1 es afirmativa, ¿se ha integrado el flujo correspondiente en la vista o editor del atleta activo?

- [ ] **3. Preservación de Datos e Independencia de Cargas**:
  * ¿La funcionalidad recalcula o adapta adecuadamente las variables prescritas (ej. marcas de 1RM, RIR, series) según el perfil único del usuario activo?

- [ ] **4. Pruebas Unitarias Duales**:
  * ¿Existen pruebas unitarias en `src/components/dashboard/__tests__/AthleteDashboard.test.tsx` o `PlanPlanner.test.tsx` que certifiquen el funcionamiento en ambos roles?

---

## 🏋️ Ejemplo de Aplicación
* **Guardado y Reutilización de Plantillas**: Disponible tanto en `PlanPlanner.tsx` (entrenadores vía Supabase DB) como en `QuickStartPlanner.tsx` (atletas independientes vía almacenamiento personal de plantillas en LocalStorage).
* **Fusión Inteligente (`planMerger.ts`)**: Inyectable en planes de clientes por el entrenador y en planes personales por el atleta autodidacta.
