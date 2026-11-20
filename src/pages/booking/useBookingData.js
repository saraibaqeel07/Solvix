import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { loadBookingData, SPORTS } from '../../lib/bookings';

// Loads bookings + settings for the signed-in padel/cricket tenant.
export default function useBookingData(sport) {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const [data, setData] = useState({ bookings: [], settings: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!uid) return Promise.resolve();
    return loadBookingData(uid, sport)
      .then(setData)
      .catch((e) => { console.error(e); toast.error('Failed to load bookings'); })
      .finally(() => setLoading(false));
  }, [uid, sport]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...data, loading, refresh, uid, userProfile, cfg: SPORTS[sport] };
}
