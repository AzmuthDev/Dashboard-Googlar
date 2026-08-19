import { useQuery } from '@tanstack/react-query';
import { fetchAuditoriaLSA } from '../lib/supabaseProvider';
import type { AuditoriaLSA } from '../types';

export function useAuditoriaLSA(empresaId: string | null | undefined) {
    return useQuery({
        queryKey: ['auditoriaLSA', empresaId],
        queryFn: async () => {
            if (!empresaId) return [];
            return await fetchAuditoriaLSA(empresaId) as AuditoriaLSA[];
        },
        enabled: !!empresaId,
    });
}
