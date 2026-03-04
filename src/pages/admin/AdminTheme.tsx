import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useVenue } from '../../context/VenueContext';
import { hexToRgb, DEFAULT_COLORS } from '../../lib/color';

export default function AdminTheme() {
  const { profile } = useAuth();
  const { settings, refreshSettings } = useVenue();

  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_COLORS.primary);
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_COLORS.accent);
  const [backgroundColor, setBackgroundColor] = useState<string>(DEFAULT_COLORS.background);
  const [appName, setAppName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setPrimaryColor(settings.primary_color);
      setAccentColor(settings.accent_color);
      setBackgroundColor(settings.background_color);
      setAppName(settings.app_name || '');
    }
  }, [settings]);

  // Live preview — convert hex to RGB for Tailwind compatibility
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', hexToRgb(primaryColor));
    document.documentElement.style.setProperty('--color-accent', hexToRgb(accentColor));
    document.documentElement.style.setProperty('--color-background', hexToRgb(backgroundColor));
  }, [primaryColor, accentColor, backgroundColor]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.venue_id || !settings) return;
    setSaving(true);

    setError('');
    let logoUrl = settings.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `${profile.venue_id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('venue-assets').upload(path, logoFile, { upsert: true });
      if (uploadErr) {
        setError(`Logo upload failed: ${uploadErr.message}`);
        setSaving(false);
        return;
      }
      const { data } = supabase.storage.from('venue-assets').getPublicUrl(path);
      logoUrl = data.publicUrl;
    }

    const { error: updateErr } = await supabase.from('venue_settings').update({
      primary_color: primaryColor,
      accent_color: accentColor,
      background_color: backgroundColor,
      app_name: appName || null,
      logo_url: logoUrl,
    }).eq('venue_id', profile.venue_id);

    if (updateErr) {
      setError(`Save failed: ${updateErr.message}`);
      setSaving(false);
      return;
    }

    await refreshSettings();
    setSaving(false);
    setMessage('Theme saved!');
  }

  async function handleReset() {
    if (!profile?.venue_id) return;
    setSaving(true);
    setError('');

    const { error: updateErr } = await supabase.from('venue_settings').update({
      primary_color: DEFAULT_COLORS.primary,
      accent_color: DEFAULT_COLORS.accent,
      background_color: DEFAULT_COLORS.background,
      app_name: null,
    }).eq('venue_id', profile.venue_id);

    if (updateErr) {
      setError(`Reset failed: ${updateErr.message}`);
      setSaving(false);
      return;
    }

    setPrimaryColor(DEFAULT_COLORS.primary);
    setAccentColor(DEFAULT_COLORS.accent);
    setBackgroundColor(DEFAULT_COLORS.background);
    setAppName('');
    await refreshSettings();
    setSaving(false);
    setMessage('Theme reset to defaults!');
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-6">Venue Theme</h1>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4 flex justify-between">
          {error} <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-2">App Name</label>
            <input value={appName} onChange={e => setAppName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" placeholder="Bar Chores" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent" />
              <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent" />
              <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Background Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent" />
              <input value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Logo</label>
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Venue logo" className="h-16 mb-3 rounded" />
            )}
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-slate-900 file:font-medium file:cursor-pointer" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
            <button type="button" onClick={handleReset} disabled={saving}
              className="px-6 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 min-h-[48px]">
              Reset
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-slate-700" style={{ backgroundColor }}>
          <div className="p-4 border-b" style={{ borderColor: accentColor + '40' }}>
            <h2 className="text-lg font-bold" style={{ color: primaryColor }}>{appName || 'Bar Chores'}</h2>
            <p className="text-sm" style={{ color: primaryColor + 'aa' }}>Live Preview</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: accentColor + '20', border: `1px solid ${accentColor}40` }}>
              <p style={{ color: primaryColor }} className="font-medium">Sample Card</p>
              <p className="text-sm" style={{ color: primaryColor + '99' }}>This is how your venue will look</p>
            </div>
            <button className="px-6 py-2.5 rounded-lg font-medium" style={{ backgroundColor: primaryColor, color: backgroundColor }}>
              Sample Button
            </button>
            <div className="flex gap-2">
              <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: accentColor + '30', color: accentColor }}>Tag 1</span>
              <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: primaryColor + '30', color: primaryColor }}>Tag 2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
