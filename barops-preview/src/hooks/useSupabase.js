import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabase() {
  const [status, setStatus] = useState({
    connected: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    async function checkConnection() {
      if (!supabase) {
        if (mounted) setStatus({ connected: false, loading: false, error: 'Faltan credenciales de Supabase' });
        return;
      }

      try {
        // Hacemos una consulta muy ligera a una tabla para verificar conexión
        // Usamos limit(1) para no consumir recursos
        const { error } = await supabase.from('locales').select('id').limit(1);
        
        if (error) {
          throw error;
        }

        if (mounted) {
          setStatus({
            connected: true,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error de conexión con Supabase:', err);
        if (mounted) {
          setStatus({
            connected: false,
            loading: false,
            error: err.message || 'Error de conexión'
          });
        }
      }
    }

    checkConnection();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}
