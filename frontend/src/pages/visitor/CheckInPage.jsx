import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  User,
  Hash,
  ArrowRight,
  ArrowLeft,
  Loader,
  QrCode,
  Check,
  Navigation,
  AlertTriangle,
  Building2,
  Compass,
  Sparkles,
} from 'lucide-react';
import { useSinarms } from '../../context/SinarmsContext';
import { useLanguage } from '../../context/LanguageContext';
import { CHECKIN_RADIUS_M, distanceMeters, isValidLatLng } from '../../lib/geo';

// Accepts letters (incl. accents), spaces, hyphens, apostrophes — covers Rwandan,
// French and English visitor names. Min length 2 enforced separately.
const NAME_RE = /^[\p{L}][\p{L}\s'’\-.]{1,}$/u;

// Rwanda phone: local 07XXXXXXXX (10 digits) or international +2507XXXXXXXX
// (12 digits with optional leading +). Spaces / dashes are tolerated and
// stripped before checking so users can paste numbers in any common shape.
const PHONE_LOCAL_RE = /^07\d{8}$/;
const PHONE_INTL_RE = /^\+?2507\d{8}$/;

// Rwandan National ID — 16 digits. The first digit indicates citizenship
// status (1 = Rwandan, 2 = foreign resident); we validate the prefix loosely.
const NATIONAL_ID_RE = /^[12]\d{15}$/;

function stripFormatting(value) {
  return String(value || '').replace(/[\s\-()]/g, '');
}

function detectIdOrPhoneError(rawValue, t) {
  const value = stripFormatting(rawValue);
  if (!value) return t('visitor.checkin.errors.idOrPhoneRequired');

  const looksLikePhone = value.startsWith('+') || value.startsWith('07') || value.startsWith('250');
  const looksLikeId = /^[12]\d/.test(value) && value.length >= 12;

  if (looksLikePhone) {
    if (PHONE_LOCAL_RE.test(value) || PHONE_INTL_RE.test(value)) return null;
    return t('visitor.checkin.errors.phoneInvalid');
  }

  if (looksLikeId) {
    if (NATIONAL_ID_RE.test(value)) return null;
    return t('visitor.checkin.errors.idInvalid');
  }

  return t('visitor.checkin.errors.idOrPhoneInvalid');
}

function detectNameError(rawValue, t) {
  const value = String(rawValue || '').trim();
  if (!value) return t('visitor.checkin.errors.nameRequired');
  if (value.length < 2) return t('visitor.checkin.errors.nameTooShort');
  if (!NAME_RE.test(value)) return t('visitor.checkin.errors.nameInvalid');
  return null;
}

export default function CheckInPage() {
  const navigate = useNavigate();
  const { state, classifyVisitorDestination, registerVisitor, qrCheckin, isReady, currentVisitor } = useSinarms();
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState({ name: '', idOrPhone: '', destination: '' });
  const [touched, setTouched] = useState({ name: false, idOrPhone: false });
  const [step, setStep] = useState(0); // 0 = location, 1 = identity, 2 = destination
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [qrStatus, setQrStatus] = useState(null);
  const qrAttemptRef = useRef(false);
  const [gpsCoords, setGpsCoords] = useState(null); // [lat, lng]
  const [gpsState, setGpsState] = useState('pending'); // 'pending' | 'granted' | 'denied' | 'unavailable'

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsState('unavailable');
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsCoords([pos.coords.latitude, pos.coords.longitude]);
        setGpsState('granted');
      },
      (err) => {
        if (err?.code === 1) setGpsState('denied');
        else setGpsState('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const entranceCoords = useMemo(() => {
    if (!selectedLocationId) return null;
    const map = state.maps?.[selectedLocationId];
    const entrance = map?.nodes?.find((n) => n.id === 'entrance');
    if (!entrance || entrance.lat == null || entrance.lng == null) return null;
    const pos = [Number(entrance.lat), Number(entrance.lng)];
    return isValidLatLng(pos) ? pos : null;
  }, [selectedLocationId, state.maps]);

  const distanceToEntranceM = useMemo(() => {
    if (!isValidLatLng(gpsCoords) || !isValidLatLng(entranceCoords)) return null;
    return distanceMeters(gpsCoords, entranceCoords);
  }, [gpsCoords, entranceCoords]);

  const isOutOfRange =
    gpsState === 'granted' &&
    distanceToEntranceM != null &&
    distanceToEntranceM > CHECKIN_RADIUS_M;

  const nameError = detectNameError(formData.name, t);
  const idOrPhoneError = detectIdOrPhoneError(formData.idOrPhone, t);
  const showNameError = touched.name && nameError;
  const showIdOrPhoneError = touched.idOrPhone && idOrPhoneError;
  const isFormValid = !nameError && !idOrPhoneError;

  const activeOrganization =
    state.organizations.find((organization) => organization.status === 'active') || state.organizations[0] || null;
  const activeLocation =
    state.locations.find(
      (location) =>
        location.status === 'active' && (!activeOrganization || location.organizationId === activeOrganization.id),
    ) ||
    state.locations.find((location) => location.status === 'active') ||
    state.locations[0] ||
    null;

  useEffect(() => {
    if (!selectedLocationId && activeLocation) {
      setSelectedLocationId(activeLocation.id);
    }
  }, [activeLocation, selectedLocationId]);

  const selectedLocation = state.locations.find((location) => location.id === selectedLocationId) || activeLocation;
  const selectedOrganization =
    (selectedLocation
      ? state.organizations.find((organization) => organization.id === selectedLocation.organizationId)
      : null) || activeOrganization;

  const destinationOptions = useMemo(() => {
    const map = (selectedLocationId && state.maps[selectedLocationId]) || null;
    if (!map?.nodes?.length) {
      return [];
    }

    return map.nodes
      .filter((node) => node.type !== 'exit' && node.type !== 'checkpoint')
      .filter((node) => node.type === 'office')
      .slice()
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((node) => ({ value: node.id, label: node.label }));
  }, [selectedLocationId, state.maps]);

  // QR scan flow: when the visitor lands on /visit?qr=<token>&location=<id>,
  // skip the form entirely and create the visit straight away. Once it
  // succeeds we navigate to the map dashboard. We strip the query params
  // afterwards so a manual reload doesn't re-attempt the registration.
  useEffect(() => {
    if (!isReady) return;
    if (qrAttemptRef.current) return;
    const qrToken = searchParams.get('qr');
    const qrLocationId = searchParams.get('location');
    if (!qrToken || !qrLocationId) return;

    qrAttemptRef.current = true;
    setQrStatus({ kind: 'loading' });

    qrCheckin({
      qrToken,
      locationId: qrLocationId,
      language: language === 'fr' ? 'fr' : language === 'rw' ? 'rw' : 'en',
    })
      .then((visitor) => {
        const next = new URLSearchParams(searchParams);
        next.delete('qr');
        next.delete('location');
        setSearchParams(next, { replace: true });
        navigate('/visit/navigate', { state: { visitorId: visitor.id }, replace: true });
      })
      .catch(() => {
        setQrStatus({ kind: 'error' });
        qrAttemptRef.current = false;
      });
  }, [isReady, searchParams, qrCheckin, navigate, setSearchParams, language]);

  const TOTAL_STEPS = 3;
  const steps = [
    t('visitor.checkin.step.location'),
    t('visitor.checkin.step.identity'),
    t('visitor.checkin.step.destination'),
  ];
  const destinationChosen =
    Boolean(selectedDestination) &&
    (selectedDestination !== 'other' || formData.destination.trim().length > 0);
  const isStepValid = (s) => {
    if (s === 0) return Boolean(selectedLocationId);
    if (s === 1) return !nameError && !idOrPhoneError;
    if (s === 2) return destinationChosen;
    return true;
  };
  const goNext = () => {
    if (step === 1) setTouched({ name: true, idOrPhone: true });
    if (!isStepValid(step)) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // The form spans multiple steps. Submitting from a non-final step (button
    // or Enter key) just advances to the next step instead of registering.
    if (step < TOTAL_STEPS - 1) {
      goNext();
      return;
    }

    setTouched({ name: true, idOrPhone: true });

    if (nameError || idOrPhoneError) {
      // Surface the inline errors instead of submitting an invalid form.
      setStep(1);
      return;
    }

    setIsProcessing(true);

    const apiLanguage = language === 'fr' ? 'fr' : language === 'rw' ? 'rw' : 'en';

    if (!selectedOrganization || !selectedLocation) {
      setIsProcessing(false);
      window.alert(t('visitor.checkin.loading'));
      return;
    }

    try {
      let destinationNodeId = null;

      if (selectedDestination && selectedDestination !== 'other') {
        destinationNodeId = selectedDestination;
      } else {
        const decision = await classifyVisitorDestination({
          locationId: selectedLocation.id,
          destinationText: formData.destination,
          language: apiLanguage,
        });

        if (decision.status === 'retry') {
          window.alert(decision.message || t('visitor.checkin.notFound'));
          return;
        }

        destinationNodeId =
          decision.status === 'resolved'
            ? decision.destinationNodeId
            : decision.alternatives?.[0]?.nodeId || null;

        if (!destinationNodeId) {
          window.alert(decision.message || t('visitor.checkin.notFound'));
          return;
        }
      }

      const visitor = await registerVisitor({
        name: formData.name.trim(),
        idOrPhone: stripFormatting(formData.idOrPhone),
        destinationText:
          selectedDestination && selectedDestination !== 'other'
            ? destinationOptions.find((option) => option.value === selectedDestination)?.label || formData.destination
            : formData.destination,
        language: apiLanguage,
        organizationId: selectedOrganization.id,
        locationId: selectedLocation.id,
        source: 'self',
        destinationNodeId,
        gpsLat: isValidLatLng(gpsCoords) ? gpsCoords[0] : null,
        gpsLng: isValidLatLng(gpsCoords) ? gpsCoords[1] : null,
      });

      navigate('/visit/navigate', { state: { visitorId: visitor.id } });
    } catch (err) {
      window.alert(err?.message || t('visitor.checkin.unable'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (qrStatus?.kind === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
          <QrCode size={32} className="text-white" />
        </div>
        <Loader className="animate-spin text-[var(--color-brand-terracotta)] dark:text-red-400 mb-3" size={28} />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
          {t('visitor.checkin.qrLoading')}
        </p>
      </div>
    );
  }

  const stepTitleKeys = ['visitor.checkin.location', 'visitor.checkin.fullName', 'visitor.checkin.dest'];
  const stepHelpKeys = [
    'visitor.checkin.step.location.help',
    'visitor.checkin.step.identity.help',
    'visitor.checkin.step.destination.help',
  ];
  const stepHelp = t(stepHelpKeys[step]);
  const stepTitle = t(stepTitleKeys[step]);

  const orgName = selectedOrganization?.name || 'SINARMS';
  const locationName = selectedLocation?.name || '';

  return (
    <div className="flex w-full justify-center">
      {qrStatus?.kind === 'error' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm font-semibold text-red-700 dark:text-red-300 shadow-lg">
          {t('visitor.checkin.qrFailed')}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[1024px] grid grid-cols-1 lg:grid-cols-[44%_56%] rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10 dark:shadow-black/40 ring-1 ring-slate-200/70 dark:ring-slate-800/70 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl"
      >
        {/* ============ LEFT PANEL ============ */}
        <div className="relative hidden lg:flex flex-col justify-between p-9 xl:p-11 text-white bg-gradient-to-br from-[#160b0b] via-[#1d0f10] to-[#2b1414] overflow-hidden min-h-[640px]">
          {/* Dotted grid */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='1' cy='1' r='1' fill='rgba(255,255,255,0.18)'/></svg>\")",
            }}
          />
          {/* Radial glows */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[var(--color-brand-terracotta)]/40 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-red-700/30 rounded-full blur-[120px] pointer-events-none" />

          {/* Top: eyebrow + welcome */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85">
              <Sparkles size={11} className="text-[var(--color-brand-light-clay)]" />
              {t('visitor.checkin.eyebrow')}
            </span>
            <h1 className="mt-5 text-3xl xl:text-[2.1rem] font-black leading-[1.1] tracking-tight">
              {t('visitor.checkin.side.headline')}
            </h1>
            <p className="mt-3 text-sm text-white/65 leading-relaxed max-w-md">
              {t('visitor.checkin.side.subhead')}
            </p>
          </div>

          {/* Middle: vertical step indicator */}
          <ul className="relative z-10 space-y-4">
            {steps.map((label, i) => {
              const isDone = i < step;
              const isActive = i === step;
              return (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
                  className="flex items-center gap-4"
                >
                  <span
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 transition-colors ${
                      isDone
                        ? 'bg-[var(--color-brand-terracotta)] text-white shadow-lg shadow-red-900/50'
                        : isActive
                          ? 'bg-[var(--color-brand-terracotta)] text-white shadow-lg shadow-red-900/50 ring-4 ring-[var(--color-brand-terracotta)]/30'
                          : 'bg-white/10 text-white/60 border border-white/15'
                    }`}
                  >
                    {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="leading-tight">
                    <p
                      className={`text-sm font-bold ${
                        isActive || isDone ? 'text-white' : 'text-white/55'
                      }`}
                    >
                      {label}
                    </p>
                    <p
                      className={`text-[11px] font-medium ${
                        isActive || isDone ? 'text-white/60' : 'text-white/35'
                      }`}
                    >
                      {t(stepHelpKeys[i])}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>

          {/* Bottom: welcome chip + already-in link */}
          <div className="relative z-10 space-y-3">
            {selectedOrganization && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 flex items-center justify-center flex-shrink-0">
                  <Building2 size={15} className="text-white" />
                </span>
                <div className="leading-tight min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    {t('visitor.checkin.location')}
                  </p>
                  <p className="text-sm font-bold text-white truncate">
                    {orgName}
                    {locationName ? ` · ${locationName}` : ''}
                  </p>
                </div>
              </div>
            )}
            {currentVisitor?.id && (
              <button
                type="button"
                onClick={() => navigate('/visit/navigate')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left group"
              >
                <span className="text-xs font-semibold text-white/70">
                  {t('visitor.checkin.side.alreadyIn')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-brand-light-clay)] group-hover:text-white transition-colors">
                  {t('visitor.checkin.side.openRoute')}
                  <ArrowRight size={12} />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ============ RIGHT PANEL ============ */}
        <div className="relative p-6 sm:p-9 xl:p-11 flex flex-col min-h-[560px]">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 shadow-md shadow-red-500/30 flex items-center justify-center">
              <MapPin size={18} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-terracotta)]">
                {t('visitor.checkin.eyebrow')}
              </p>
              <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white truncate">
                {orgName}
              </p>
            </div>
          </div>

          {/* Step header */}
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-terracotta)] dark:text-[var(--color-brand-light-clay)]">
              {t('visitor.checkin.stepOf', { current: step + 1, total: TOTAL_STEPS })}
            </p>
            <h2 className="mt-1.5 text-2xl sm:text-[1.7rem] font-black tracking-tight text-slate-900 dark:text-white">
              {stepTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stepHelp}</p>

            {/* progress bar */}
            <div className="mt-4 h-1 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--color-brand-terracotta)] to-red-500"
                initial={false}
                animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            {/* GPS proximity banner */}
            {gpsState === 'pending' && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Loader size={14} className="animate-spin text-slate-400 dark:text-slate-500" />
                {t('visitor.checkin.locating')}
              </div>
            )}
            {gpsState === 'granted' && distanceToEntranceM != null && !isOutOfRange && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Navigation size={14} />
                {t('visitor.checkin.inRange', { meters: Math.round(distanceToEntranceM) })}
              </div>
            )}
            {gpsState === 'granted' && isOutOfRange && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {t('visitor.checkin.outOfRange', {
                    meters: Math.round(distanceToEntranceM),
                    radius: CHECKIN_RADIUS_M,
                  })}
                </span>
              </div>
            )}
            {(gpsState === 'denied' || gpsState === 'unavailable') && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <span>{t('visitor.checkin.locationOff')}</span>
              </div>
            )}

            {/* Step body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* Step 1 — Location */}
                {step === 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] mb-1.5">
                      {t('visitor.checkin.location')}
                    </label>
                    <div className="relative">
                      <Compass
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <select
                        value={selectedLocationId}
                        onChange={(e) => {
                          setSelectedLocationId(e.target.value);
                          setSelectedDestination('');
                          setFormData((prev) => ({ ...prev, destination: '' }));
                        }}
                        className="w-full appearance-none bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-10 h-12 outline-none focus:border-[var(--color-brand-terracotta)] focus:ring-4 focus:ring-[var(--color-brand-terracotta)]/15 transition-all font-medium"
                      >
                        {(state.locations || [])
                          .filter((location) => location.status === 'active')
                          .map((location) => {
                            const orgN = state.organizations.find(
                              (org) =>
                                org.id === location.organizationId && org.status === 'active',
                            )?.name;
                            if (!orgN) return null;
                            return (
                              <option key={location.id} value={location.id}>
                                {`${orgN} | ${location.name}`}
                              </option>
                            );
                          })}
                      </select>
                      <ArrowRight
                        size={14}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2 — Identity */}
                {step === 1 && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] mb-1.5">
                        {t('visitor.checkin.fullName')}
                      </label>
                      <div className="relative">
                        <User
                          size={17}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                            showNameError
                              ? 'text-red-500'
                              : 'text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)]'
                          }`}
                        />
                        <input
                          type="text"
                          required
                          autoFocus
                          aria-invalid={Boolean(showNameError)}
                          aria-describedby={showNameError ? 'visitor-name-error' : undefined}
                          className={`w-full bg-white dark:bg-slate-900/60 border text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-11 pr-4 h-12 outline-none focus:ring-4 transition-all font-medium ${
                            showNameError
                              ? 'border-red-400 dark:border-red-500/60 focus:border-red-500 focus:ring-red-500/15'
                              : 'border-slate-200 dark:border-slate-700 focus:border-[var(--color-brand-terracotta)] focus:ring-[var(--color-brand-terracotta)]/15'
                          }`}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                        />
                      </div>
                      {showNameError && (
                        <p
                          id="visitor-name-error"
                          className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1"
                        >
                          <AlertTriangle size={11} />
                          {nameError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] mb-1.5">
                        {t('visitor.checkin.idOrPhone')}
                      </label>
                      <div className="relative">
                        <Hash
                          size={17}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                            showIdOrPhoneError
                              ? 'text-red-500'
                              : 'text-slate-400 group-focus-within:text-[var(--color-brand-terracotta)]'
                          }`}
                        />
                        <input
                          type="text"
                          required
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder={t('visitor.checkin.idOrPhoneHint')}
                          aria-invalid={Boolean(showIdOrPhoneError)}
                          aria-describedby={
                            showIdOrPhoneError ? 'visitor-idphone-error' : 'visitor-idphone-hint'
                          }
                          className={`w-full bg-white dark:bg-slate-900/60 border text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-11 pr-4 h-12 outline-none focus:ring-4 transition-all font-medium ${
                            showIdOrPhoneError
                              ? 'border-red-400 dark:border-red-500/60 focus:border-red-500 focus:ring-red-500/15'
                              : 'border-slate-200 dark:border-slate-700 focus:border-[var(--color-brand-terracotta)] focus:ring-[var(--color-brand-terracotta)]/15'
                          }`}
                          value={formData.idOrPhone}
                          onChange={(e) =>
                            setFormData({ ...formData, idOrPhone: e.target.value })
                          }
                          onBlur={() => setTouched((prev) => ({ ...prev, idOrPhone: true }))}
                        />
                      </div>
                      {showIdOrPhoneError ? (
                        <p
                          id="visitor-idphone-error"
                          className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1"
                        >
                          <AlertTriangle size={11} />
                          {idOrPhoneError}
                        </p>
                      ) : (
                        <p
                          id="visitor-idphone-hint"
                          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5"
                        >
                          {t('visitor.checkin.idOrPhoneHint')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Step 3 — Destination */}
                {step === 2 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] mb-1.5">
                      {t('visitor.checkin.dest')}
                    </label>
                    <div className="relative">
                      <MapPin
                        size={17}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <select
                        value={selectedDestination}
                        onChange={(e) => {
                          const next = e.target.value;
                          setSelectedDestination(next);
                          if (next && next !== 'other') {
                            const label =
                              destinationOptions.find((option) => option.value === next)?.label || '';
                            setFormData((prev) => ({ ...prev, destination: label }));
                          } else {
                            setFormData((prev) => ({ ...prev, destination: '' }));
                          }
                        }}
                        className="w-full appearance-none bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl pl-11 pr-10 h-12 outline-none focus:border-[var(--color-brand-terracotta)] focus:ring-4 focus:ring-[var(--color-brand-terracotta)]/15 transition-all font-medium"
                        required
                      >
                        <option value="" disabled>
                          {t('visitor.checkin.selectDest')}
                        </option>
                        {destinationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                        <option value="other">{t('visitor.checkin.other')}</option>
                      </select>
                      <ArrowRight
                        size={14}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none"
                      />
                    </div>

                    {selectedDestination === 'other' && (
                      <textarea
                        required
                        rows={3}
                        placeholder={t('visitor.checkin.destPlaceholder')}
                        className="mt-3 w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-4 outline-none focus:border-[var(--color-brand-terracotta)] focus:ring-4 focus:ring-[var(--color-brand-terracotta)]/15 transition-all resize-none font-medium"
                        value={formData.destination}
                        onChange={(e) =>
                          setFormData({ ...formData, destination: e.target.value })
                        }
                      />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Spacer pushes buttons to bottom */}
            <div className="flex-1 min-h-6" />

            {/* Buttons */}
            {isProcessing ? (
              <div className="w-full py-4 mt-6 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-700">
                <Loader
                  className="animate-spin text-[var(--color-brand-terracotta)] dark:text-red-400"
                  size={20}
                />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('visitor.checkin.analyzing')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-6">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center justify-center gap-1.5 px-5 h-12 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    <ArrowLeft size={16} /> {t('visitor.checkin.back')}
                  </button>
                )}

                {step < TOTAL_STEPS - 1 ? (
                  <motion.button
                    whileTap={isStepValid(step) ? { scale: 0.985 } : undefined}
                    type="button"
                    onClick={goNext}
                    disabled={!isStepValid(step)}
                    aria-disabled={!isStepValid(step)}
                    className={`relative flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 group overflow-hidden transition-shadow ${
                      isStepValid(step)
                        ? 'bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isStepValid(step) && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                    <span>{t('visitor.checkin.next')}</span>
                    <ArrowRight
                      size={16}
                      className={isStepValid(step) ? 'group-hover:translate-x-0.5 transition-transform' : ''}
                    />
                  </motion.button>
                ) : (() => {
                  const canSubmit = isFormValid && destinationChosen && !isOutOfRange;
                  return (
                    <motion.button
                      whileTap={canSubmit ? { scale: 0.985 } : undefined}
                      type="submit"
                      disabled={!canSubmit}
                      aria-disabled={!canSubmit}
                      className={`relative flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 group overflow-hidden transition-shadow ${
                        canSubmit
                          ? 'bg-gradient-to-br from-[var(--color-brand-terracotta)] to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canSubmit && (
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      )}
                      <Navigation size={16} />
                      <span>{t('visitor.checkin.start')}</span>
                    </motion.button>
                  );
                })()}
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
