-- Axon Mind v2: Actualización de Tabla Tasks para Energía y Nevera

-- Añadir nivel de energía (high, medium, low)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'medium';

-- Nota: El campo 'status' ya existe en 'tasks' (actualmente soporta 'todo', 'doing', 'done').
-- Ahora también soportaremos 'frozen' a nivel de aplicación, no requiere cambio de esquema en SQL
-- siempre y cuando la columna sea tipo texto.
