import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import { hexToRgb, DEFAULT_RGB } from '../../lib/color';
import type { Profile, VenueSettings } from '../../types/database';

interface AvatarConfig {
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  accessory: string;
}

function AvatarSVG({ config, size = 64 }: { config: AvatarConfig; size?: number }) {
  const { skinTone, hairColor, hairStyle, accessory } = config;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="rounded-full">
      <circle cx="60" cy="60" r="60" fill="#1E293B" />
      <ellipse cx="60" cy="55" rx="30" ry="35" fill={skinTone} />
      <circle cx="48" cy="50" r="3" fill="#1E293B" />
      <circle cx="72" cy="50" r="3" fill="#1E293B" />
      <path d="M 50 65 Q 60 72 70 65" stroke="#1E293B" strokeWidth="2" fill="none" />
      {hairStyle === 'short' && <path d="M 30 45 Q 30 20 60 18 Q 90 20 90 45" fill={hairColor} />}
      {hairStyle === 'medium' && <path d="M 28 50 Q 25 15 60 12 Q 95 15 92 50 L 88 45 Q 85 20 60 18 Q 35 20 32 45 Z" fill={hairColor} />}
      {hairStyle === 'long' && <><path d="M 28 50 Q 25 15 60 12 Q 95 15 92 50" fill={hairColor} /><rect x="28" y="45" width="8" height="30" rx="4" fill={hairColor} /><rect x="84" y="45" width="8" height="30" rx="4" fill={hairColor} /></>}
      {hairStyle === 'buzz' && <path d="M 32 45 Q 32 22 60 20 Q 88 22 88 45" fill={hairColor} />}
      {hairStyle === 'curly' && <><circle cx="40" cy="25" r="10" fill={hairColor} /><circle cx="60" cy="20" r="10" fill={hairColor} /><circle cx="80" cy="25" r="10" fill={hairColor} /><circle cx="35" cy="38" r="8" fill={hairColor} /><circle cx="85" cy="38" r="8" fill={hairColor} /></>}
      {hairStyle === 'mohawk' && <rect x="52" y="8" width="16" height="30" rx="6" fill={hairColor} />}
      {accessory === 'glasses' && <><circle cx="48" cy="50" r="8" stroke="#374151" strokeWidth="2" fill="none" /><circle cx="72" cy="50" r="8" stroke="#374151" strokeWidth="2" fill="none" /><line x1="56" y1="50" x2="64" y2="50" stroke="#374151" strokeWidth="2" /></>}
      {accessory === 'sunglasses' && <><circle cx="48" cy="50" r="9" fill="#374151" /><circle cx="72" cy="50" r="9" fill="#374151" /><line x1="57" y1="50" x2="63" y2="50" stroke="#374151" strokeWidth="3" /></>}
      {accessory === 'cap' && <path d="M 25 40 Q 25 15 60 12 Q 95 15 95 40 L 100 42 L 20 42 Z" fill="#3B82F6" />}
      {accessory === 'headband' && <rect x="28" y="35" width="64" height="5" rx="2" fill="#EF4444" />}
    </svg>
  );
}

export default function StaffLogin() {
  const [venues, setVenues] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [venueSettings, setVenueSettings] = useState<Record<string, VenueSettings>>({});
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const { staffLogin } = useAuth();
  const navigate = useNavigate();

  // Load venues + their settings on mount
  useEffect(() => {
    async function loadVenues() {
      logger.api('StaffLogin: loading venues');
      const { data, error: err } = await supabase.from('venues').select('id, name, slug');
      if (err) logger.error('Failed to load venues', err.message);
      else logger.api(`Loaded ${data?.length ?? 0} venues`);
      if (data) {
        setVenues(data);
        // Load venue settings for logos
        const { data: settings } = await supabase.from('venue_settings').select('*');
        if (settings) {
          const map: Record<string, VenueSettings> = {};
          for (const s of settings) map[s.venue_id] = s as VenueSettings;
          setVenueSettings(map);
        }
      }
      setLoadingVenues(false);
    }
    loadVenues();
  }, []);

  // Auto-select if there's only one venue (convenience)
  useEffect(() => {
    if (venues.length === 1 && !selectedVenue) {
      setSelectedVenue(venues[0].id);
    }
  }, [venues]);

  // Apply venue theme colors when selected
  useEffect(() => {
    const root = document.documentElement;
    if (selectedVenue && venueSettings[selectedVenue]) {
      const vs = venueSettings[selectedVenue];
      root.style.setProperty('--color-primary', hexToRgb(vs.primary_color));
      root.style.setProperty('--color-accent', hexToRgb(vs.accent_color));
      root.style.setProperty('--color-background', hexToRgb(vs.background_color));
    } else {
      root.style.setProperty('--color-primary', DEFAULT_RGB.primary);
      root.style.setProperty('--color-accent', DEFAULT_RGB.accent);
      root.style.setProperty('--color-background', DEFAULT_RGB.background);
    }
  }, [selectedVenue, venueSettings]);

  // Load staff when venue selected
  useEffect(() => {
    if (!selectedVenue) {
      setStaffList([]);
      return;
    }
    async function loadStaff() {
      logger.api(`StaffLogin: loading staff for venue ${selectedVenue}`);
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('venue_id', selectedVenue)
        .eq('role', 'staff')
        .order('display_name');
      if (err) logger.error('Failed to load staff', err.message);
      else logger.api(`Loaded ${data?.length ?? 0} staff members`);
      if (data) setStaffList(data as Profile[]);
    }
    loadStaff();
  }, [selectedVenue]);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaff || !selectedVenue) return;
    setError('');
    setLoading(true);

    logger.auth(`Staff PIN submit: ${selectedStaff.username}`);
    const { error } = await staffLogin(selectedStaff.username!, pin, selectedVenue);
    setLoading(false);

    if (error) {
      logger.error('Staff login error', error);
      setError(error);
      setPin('');
    } else {
      logger.nav('Staff login success, navigating to dashboard');
      navigate('/staff/dashboard');
    }
  }

  function getInitials(name: string | null) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  // Generate a consistent color from name for avatar background
  function getAvatarColor(name: string | null) {
    if (!name) return 'bg-primary/20';
    const colors = [
      'bg-blue-500/30', 'bg-green-500/30', 'bg-purple-500/30',
      'bg-pink-500/30', 'bg-orange-500/30', 'bg-teal-500/30',
      'bg-indigo-500/30', 'bg-rose-500/30',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function getAvatarTextColor(name: string | null) {
    if (!name) return 'text-primary';
    const colors = [
      'text-blue-400', 'text-green-400', 'text-purple-400',
      'text-pink-400', 'text-orange-400', 'text-teal-400',
      'text-indigo-400', 'text-rose-400',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  if (loadingVenues) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-md mx-auto">
        {selectedVenue && !selectedStaff ? (() => {
          const v = venues.find(v => v.id === selectedVenue);
          const vs = venueSettings[selectedVenue];
          const initials = v ? v.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
          return (
            <div className="flex flex-col items-center mb-6">
              {vs?.logo_url ? (
                <img src={vs.logo_url} alt={v?.name} className="w-16 h-16 rounded-full object-cover mb-2" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-bold mb-2">
                  {initials}
                </div>
              )}
              <h1 className="text-2xl font-bold text-white">{v?.name}</h1>
              <p className="text-slate-400 text-sm">Tap your profile to sign in</p>
            </div>
          );
        })() : (
          <>
            <h1 className="text-3xl font-bold text-primary text-center mb-2">Staff Login</h1>
            <p className="text-slate-400 text-center mb-6 text-sm">Select your venue to get started</p>
          </>
        )}

        {/* Venue selector — always show so staff can pick their venue */}
        {!selectedStaff && (
          <div className="mb-6">
            <label className="block text-sm text-slate-300 mb-2">Select your venue</label>
            {venues.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No venues available</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {venues.map(v => {
                  const vs = venueSettings[v.id];
                  const initials = v.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  const isSelected = selectedVenue === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVenue(v.id); setSelectedStaff(null); setError(''); }}
                      className={`flex flex-col items-center gap-2 p-4 bg-slate-800 border rounded-xl transition-colors min-h-[120px] justify-center ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {vs?.logo_url ? (
                        <img src={vs.logo_url} alt={v.name} className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center text-lg font-bold">
                          {initials}
                        </div>
                      )}
                      <span className="text-sm text-white font-medium text-center">{v.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Staff grid */}
        {selectedVenue && !selectedStaff && (
          <>
            {staffList.length === 0 ? (
              <p className="text-slate-500 text-center py-12">No staff members found for this venue</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {staffList.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedStaff(staff); setError(''); setPin(''); }}
                    className="flex flex-col items-center gap-2 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-primary hover:bg-slate-750 transition-colors min-h-[120px] justify-center"
                  >
                    {staff.avatar_url ? (
                      <img src={staff.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : staff.avatar_config ? (
                      <AvatarSVG config={staff.avatar_config as unknown as AvatarConfig} size={64} />
                    ) : (
                      <div className={`w-16 h-16 rounded-full ${getAvatarColor(staff.display_name)} ${getAvatarTextColor(staff.display_name)} flex items-center justify-center text-xl font-bold`}>
                        {getInitials(staff.display_name)}
                      </div>
                    )}
                    <span className="text-sm text-white font-medium text-center truncate w-full">
                      {staff.display_name || staff.username}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* PIN entry */}
        {selectedStaff && (
          <div className="mt-4">
            <button
              onClick={() => { setSelectedStaff(null); setPin(''); setError(''); }}
              className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1"
            >
              ← Back to staff list
            </button>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
              {selectedStaff.avatar_url ? (
                <img src={selectedStaff.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3" />
              ) : selectedStaff.avatar_config ? (
                <div className="flex justify-center mb-3"><AvatarSVG config={selectedStaff.avatar_config as unknown as AvatarConfig} size={80} /></div>
              ) : (
                <div className={`w-20 h-20 rounded-full ${getAvatarColor(selectedStaff.display_name)} ${getAvatarTextColor(selectedStaff.display_name)} flex items-center justify-center text-2xl font-bold mx-auto mb-3`}>
                  {getInitials(selectedStaff.display_name)}
                </div>
              )}
              <h2 className="text-lg font-bold text-white mb-1">
                {selectedStaff.display_name || selectedStaff.username}
              </h2>
              <p className="text-slate-400 text-sm mb-4">Enter your PIN</p>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-slate-500 focus:outline-none focus:border-primary"
                  placeholder="••••"
                  autoFocus
                  required
                />

                <button
                  type="submit"
                  disabled={loading || !pin}
                  className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px]"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}

        <p className="text-center mt-8 text-sm text-slate-500">
          Admin? <Link to="/login" className="text-accent hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
