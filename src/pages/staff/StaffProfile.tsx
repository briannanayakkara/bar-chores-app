import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import bcrypt from 'bcryptjs';

const SKIN_TONES = ['#FDBEB1', '#F5C5A3', '#D4A574', '#A67C52', '#6B4226', '#3B2414'];
const HAIR_COLORS = ['#2C1810', '#5A3825', '#8B6914', '#C4A35A', '#D4641B', '#B91C1C', '#1E3A5F', '#6B21A8'];
const HAIR_STYLES = ['short', 'medium', 'long', 'buzz', 'curly', 'mohawk'];
const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'cap', 'headband'];

interface AvatarConfig {
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  accessory: string;
}

function AvatarSVG({ config, size = 120 }: { config: AvatarConfig; size?: number }) {
  const { skinTone, hairColor, hairStyle, accessory } = config;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="rounded-full">
      {/* Background */}
      <circle cx="60" cy="60" r="60" fill="#1E293B" />
      {/* Head */}
      <ellipse cx="60" cy="55" rx="30" ry="35" fill={skinTone} />
      {/* Eyes */}
      <circle cx="48" cy="50" r="3" fill="#1E293B" />
      <circle cx="72" cy="50" r="3" fill="#1E293B" />
      {/* Mouth */}
      <path d="M 50 65 Q 60 72 70 65" stroke="#1E293B" strokeWidth="2" fill="none" />
      {/* Hair */}
      {hairStyle === 'short' && <path d="M 30 45 Q 30 20 60 18 Q 90 20 90 45" fill={hairColor} />}
      {hairStyle === 'medium' && <path d="M 28 50 Q 25 15 60 12 Q 95 15 92 50 L 88 45 Q 85 20 60 18 Q 35 20 32 45 Z" fill={hairColor} />}
      {hairStyle === 'long' && <><path d="M 28 50 Q 25 15 60 12 Q 95 15 92 50" fill={hairColor} /><rect x="28" y="45" width="8" height="30" rx="4" fill={hairColor} /><rect x="84" y="45" width="8" height="30" rx="4" fill={hairColor} /></>}
      {hairStyle === 'buzz' && <path d="M 32 45 Q 32 22 60 20 Q 88 22 88 45" fill={hairColor} />}
      {hairStyle === 'curly' && <><circle cx="40" cy="25" r="10" fill={hairColor} /><circle cx="60" cy="20" r="10" fill={hairColor} /><circle cx="80" cy="25" r="10" fill={hairColor} /><circle cx="35" cy="38" r="8" fill={hairColor} /><circle cx="85" cy="38" r="8" fill={hairColor} /></>}
      {hairStyle === 'mohawk' && <rect x="52" y="8" width="16" height="30" rx="6" fill={hairColor} />}
      {/* Accessories */}
      {accessory === 'glasses' && <><circle cx="48" cy="50" r="8" stroke="#374151" strokeWidth="2" fill="none" /><circle cx="72" cy="50" r="8" stroke="#374151" strokeWidth="2" fill="none" /><line x1="56" y1="50" x2="64" y2="50" stroke="#374151" strokeWidth="2" /></>}
      {accessory === 'sunglasses' && <><circle cx="48" cy="50" r="9" fill="#374151" /><circle cx="72" cy="50" r="9" fill="#374151" /><line x1="57" y1="50" x2="63" y2="50" stroke="#374151" strokeWidth="3" /></>}
      {accessory === 'cap' && <path d="M 25 40 Q 25 15 60 12 Q 95 15 95 40 L 100 42 L 20 42 Z" fill="#3B82F6" />}
      {accessory === 'headband' && <rect x="28" y="35" width="64" height="5" rx="2" fill="#EF4444" />}
    </svg>
  );
}

export default function StaffProfile() {
  const { profile, logout } = useAuth();
  const [tab, setTab] = useState<'avatar' | 'pin'>('avatar');

  // Avatar state
  const [avatarType, setAvatarType] = useState<'photo' | 'builder'>(profile?.avatar_type as any || 'builder');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    (profile?.avatar_config as any) || { skinTone: SKIN_TONES[0], hairColor: HAIR_COLORS[0], hairStyle: 'short', accessory: 'none' }
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isFirstLogin = !profile?.avatar_type;

  async function saveAvatar() {
    if (!profile) return;
    setSavingAvatar(true); setError('');

    if (avatarType === 'photo' && photoFile) {
      const path = `${profile.id}.${photoFile.name.split('.').pop()}`;
      const { error: uploadErr } = await supabase.storage.from('profile-pictures').upload(path, photoFile, { upsert: true });
      if (uploadErr) { setError(uploadErr.message); setSavingAvatar(false); return; }
      const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_type: 'photo', avatar_url: data.publicUrl, avatar_config: null }).eq('id', profile.id);
    } else {
      await supabase.from('profiles').update({ avatar_type: 'builder', avatar_config: avatarConfig, avatar_url: null }).eq('id', profile.id);
    }

    setSavingAvatar(false);

    if (isFirstLogin) {
      setMessage('Avatar saved! Now change your PIN below, then you\'ll be logged out to sign in fresh.');
      setTab('pin');
    } else {
      setMessage('Avatar saved!');
    }
  }

  async function changePin() {
    if (!profile?.pin_hash) { setError('No current PIN set'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match'); return; }
    if (newPin.length < 4) { setError('PIN must be at least 4 characters'); return; }

    setSavingPin(true); setError('');
    const valid = await bcrypt.compare(currentPin, profile.pin_hash);
    if (!valid) { setError('Current PIN is incorrect'); setSavingPin(false); return; }

    const hash = await bcrypt.hash(newPin, 10);
    await supabase.from('profiles').update({ pin_hash: hash }).eq('id', profile.id);
    setSavingPin(false);
    setCurrentPin(''); setNewPin(''); setConfirmPin('');

    if (isFirstLogin) {
      setMessage('Profile setup complete! Logging you out — sign back in with your new PIN.');
      setTimeout(() => logout(), 2000);
    } else {
      setMessage('PIN changed!');
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <button onClick={logout} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg min-h-[48px]">
          Sign Out
        </button>
      </div>

      {/* Current Profile */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover mx-auto" />
        ) : profile?.avatar_config ? (
          <div className="flex justify-center"><AvatarSVG config={profile.avatar_config as unknown as AvatarConfig} /></div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold mx-auto">
            {profile?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <h2 className="text-xl font-bold text-white mt-3">{profile?.display_name}</h2>
        <p className="text-accent font-medium">{profile?.points_total} pts</p>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex justify-between">
          {message} <button onClick={() => setMessage('')}>×</button>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex justify-between">
          {error} <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('avatar')} className={`px-4 py-2 rounded-lg text-sm ${tab === 'avatar' ? 'bg-primary text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Avatar</button>
        <button onClick={() => setTab('pin')} className={`px-4 py-2 rounded-lg text-sm ${tab === 'pin' ? 'bg-primary text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Change PIN</button>
      </div>

      {tab === 'avatar' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          {/* Type selector */}
          <div className="flex gap-3">
            <button onClick={() => setAvatarType('builder')} className={`flex-1 py-2 rounded-lg text-sm ${avatarType === 'builder' ? 'bg-accent text-white' : 'bg-slate-700 text-slate-400'}`}>Build Avatar</button>
            <button onClick={() => setAvatarType('photo')} className={`flex-1 py-2 rounded-lg text-sm ${avatarType === 'photo' ? 'bg-accent text-white' : 'bg-slate-700 text-slate-400'}`}>Upload Photo</button>
          </div>

          {avatarType === 'builder' ? (
            <>
              <div className="flex justify-center"><AvatarSVG config={avatarConfig} size={140} /></div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Skin Tone</label>
                <div className="flex gap-2 flex-wrap">{SKIN_TONES.map(c => (
                  <button key={c} onClick={() => setAvatarConfig({ ...avatarConfig, skinTone: c })}
                    className={`w-10 h-10 rounded-full border-2 ${avatarConfig.skinTone === c ? 'border-primary' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Hair Color</label>
                <div className="flex gap-2 flex-wrap">{HAIR_COLORS.map(c => (
                  <button key={c} onClick={() => setAvatarConfig({ ...avatarConfig, hairColor: c })}
                    className={`w-10 h-10 rounded-full border-2 ${avatarConfig.hairColor === c ? 'border-primary' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Hair Style</label>
                <div className="flex gap-2 flex-wrap">{HAIR_STYLES.map(s => (
                  <button key={s} onClick={() => setAvatarConfig({ ...avatarConfig, hairStyle: s })}
                    className={`px-3 py-2 rounded-lg text-sm capitalize ${avatarConfig.hairStyle === s ? 'bg-primary text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{s}</button>
                ))}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Accessory</label>
                <div className="flex gap-2 flex-wrap">{ACCESSORIES.map(a => (
                  <button key={a} onClick={() => setAvatarConfig({ ...avatarConfig, accessory: a })}
                    className={`px-3 py-2 rounded-lg text-sm capitalize ${avatarConfig.accessory === a ? 'bg-primary text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{a}</button>
                ))}</div>
              </div>
            </>
          ) : (
            <div>
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-slate-900 file:font-medium file:cursor-pointer" />
            </div>
          )}

          <button onClick={saveAvatar} disabled={savingAvatar}
            className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
            {savingAvatar ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      )}

      {tab === 'pin' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Current PIN</label>
            <input type="password" inputMode="numeric" value={currentPin} onChange={e => setCurrentPin(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">New PIN</label>
            <input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Confirm New PIN</label>
            <input type="password" inputMode="numeric" value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
          </div>
          <button onClick={changePin} disabled={savingPin}
            className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 min-h-[48px]">
            {savingPin ? 'Changing...' : 'Change PIN'}
          </button>
        </div>
      )}
    </div>
  );
}
