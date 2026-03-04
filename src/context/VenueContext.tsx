import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { hexToRgb, DEFAULT_RGB } from '../lib/color';
import type { VenueSettings, Venue } from '../types/database';

interface VenueContextType {
  venue: Venue | null;
  settings: VenueSettings | null;
  loading: boolean;
  setVenueBySlug: (slug: string) => Promise<void>;
  setVenueById: (id: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

function injectTheme(settings: VenueSettings | null) {
  const root = document.documentElement;
  if (settings) {
    root.style.setProperty('--color-primary', hexToRgb(settings.primary_color));
    root.style.setProperty('--color-accent', hexToRgb(settings.accent_color));
    root.style.setProperty('--color-background', hexToRgb(settings.background_color));
  } else {
    root.style.setProperty('--color-primary', DEFAULT_RGB.primary);
    root.style.setProperty('--color-accent', DEFAULT_RGB.accent);
    root.style.setProperty('--color-background', DEFAULT_RGB.background);
  }
}

export function VenueProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [settings, setSettings] = useState<VenueSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    injectTheme(settings);
  }, [settings]);

  // Auto-load venue when profile changes (e.g., after refresh + auth restore)
  useEffect(() => {
    if (profile?.venue_id && (!venue || venue.id !== profile.venue_id)) {
      setVenueById(profile.venue_id);
    }
    if (!profile) {
      setVenue(null);
      setSettings(null);
    }
  }, [profile?.venue_id]);

  async function loadSettings(venueId: string) {
    const { data } = await supabase
      .from('venue_settings')
      .select('*')
      .eq('venue_id', venueId)
      .single();
    if (data) setSettings(data as VenueSettings);
  }

  async function setVenueBySlug(slug: string) {
    setLoading(true);
    const { data } = await supabase
      .from('venues')
      .select('*')
      .eq('slug', slug)
      .single();
    if (data) {
      setVenue(data as Venue);
      await loadSettings(data.id);
    }
    setLoading(false);
  }

  async function setVenueById(id: string) {
    setLoading(true);
    const { data } = await supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single();
    if (data) {
      setVenue(data as Venue);
      await loadSettings(data.id);
    }
    setLoading(false);
  }

  async function refreshSettings() {
    if (venue) await loadSettings(venue.id);
  }

  return (
    <VenueContext.Provider value={{ venue, settings, loading, setVenueBySlug, setVenueById, refreshSettings }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenue() {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error('useVenue must be used within VenueProvider');
  return ctx;
}
