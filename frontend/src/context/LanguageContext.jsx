/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sinarms-language';
const SUPPORTED = ['en', 'fr', 'rw'];

const DICTIONARY = {
  en: {
    'lang.label': 'EN',
    'lang.english': 'English',
    'lang.french': 'Français',
    'lang.kinyarwanda': 'Kinyarwanda',

    'visitor.checkin.title': 'Welcome to {org}',
    'visitor.checkin.subtitle': 'Please check in to start your visit.',
    'visitor.checkin.location': 'Location',
    'visitor.checkin.fullName': 'Full Name',
    'visitor.checkin.idOrPhone': 'ID or Phone',
    'visitor.checkin.dest': 'Where are you going?',
    'visitor.checkin.destPlaceholder': 'e.g. Finance Office, HR Manager',
    'visitor.checkin.selectDest': 'Select a destination...',
    'visitor.checkin.other': 'Other (type it)',
    'visitor.checkin.start': 'Start Navigation',
    'visitor.checkin.analyzing': 'Analyzing destination...',
    'visitor.checkin.loading': 'System is still loading locations. Please try again.',
    'visitor.checkin.notFound': 'We could not find that destination. Please describe it differently.',
    'visitor.checkin.unable': 'Unable to start navigation right now.',
    'visitor.checkin.qrLoading': 'Preparing your QR check-in...',
    'visitor.checkin.qrFailed': 'Could not start your QR check-in. Please try again.',

    'visitor.nav.routeInstructions': 'Route Instructions',
    'visitor.nav.endVisit': 'End Visit',
    'visitor.nav.progress': 'Progress',
    'visitor.nav.eta': 'ETA',
    'visitor.nav.min': 'min',
    'visitor.nav.destination': 'Destination',
    'visitor.nav.visitor': 'Visitor',
    'visitor.nav.youAreHere': 'You are here',
    'visitor.nav.metersAway': '{meters}m away',
    'visitor.nav.metersOf': '{done} of {total} meters',
    'visitor.nav.totalSteps': '{steps} step{plural} • {meters}m total',
    'visitor.nav.noRoute': 'No route instructions available. Please ask at the Reception desk.',
    'visitor.nav.recenter': 'Recenter map',
    'visitor.nav.focusRoute': 'Focus route',
    'visitor.nav.askAssistant': 'Ask assistant',
    'visitor.nav.alerts': 'Alerts & info',
    'visitor.nav.simStart': 'Simulate walking the route (demo)',
    'visitor.nav.simStop': 'Stop simulated walk',
    'visitor.nav.followSignage': 'Follow posted signage',
    'visitor.nav.scrollTop': 'Scroll to top',
    'visitor.nav.loading': 'Loading your route...',
    'visitor.nav.arrived.title': 'You have arrived',
    'visitor.nav.arrived.message': 'You reached {destination}.',
    'visitor.nav.arrived.spoken': 'You have reached your destination.',
    'visitor.nav.alerts.your': 'Your current visit',
    'visitor.nav.alerts.onSite': 'On site',
    'visitor.nav.alerts.remaining': '{meters}m remaining • ~{minutes} min',
    'visitor.nav.alerts.emergency': 'Emergency',
    'visitor.nav.alerts.emergencyText': 'If you feel unsafe or lost, contact Reception immediately.',
    'visitor.nav.alerts.callReception': 'Call Reception',

    'visitor.layout.online': 'Online',
    'visitor.layout.navigating': 'Navigating',

    'admin.users.assignedLocation': 'Assigned Location',
    'admin.users.selectLocation': 'Select a location...',
  },

  fr: {
    'lang.label': 'FR',
    'lang.english': 'English',
    'lang.french': 'Français',
    'lang.kinyarwanda': 'Kinyarwanda',

    'visitor.checkin.title': 'Bienvenue à {org}',
    'visitor.checkin.subtitle': 'Veuillez vous enregistrer pour commencer.',
    'visitor.checkin.location': 'Lieu',
    'visitor.checkin.fullName': 'Nom complet',
    'visitor.checkin.idOrPhone': 'ID ou téléphone',
    'visitor.checkin.dest': 'Où allez-vous ?',
    'visitor.checkin.destPlaceholder': 'ex : Bureau des finances, DRH',
    'visitor.checkin.selectDest': 'Sélectionnez une destination...',
    'visitor.checkin.other': 'Autre (saisir)',
    'visitor.checkin.start': 'Démarrer la navigation',
    'visitor.checkin.analyzing': 'Analyse de la destination...',
    'visitor.checkin.loading': 'Chargement des lieux en cours. Réessayez.',
    'visitor.checkin.notFound': 'Destination introuvable. Décrivez-la différemment.',
    'visitor.checkin.unable': 'Impossible de démarrer la navigation pour le moment.',
    'visitor.checkin.qrLoading': 'Préparation de votre enregistrement QR...',
    'visitor.checkin.qrFailed': 'Impossible de démarrer l\'enregistrement QR. Réessayez.',

    'visitor.nav.routeInstructions': 'Instructions de l\'itinéraire',
    'visitor.nav.endVisit': 'Terminer la visite',
    'visitor.nav.progress': 'Progrès',
    'visitor.nav.eta': 'ETA',
    'visitor.nav.min': 'min',
    'visitor.nav.destination': 'Destination',
    'visitor.nav.visitor': 'Visiteur',
    'visitor.nav.youAreHere': 'Vous êtes ici',
    'visitor.nav.metersAway': 'à {meters}m',
    'visitor.nav.metersOf': '{done} sur {total} mètres',
    'visitor.nav.totalSteps': '{steps} étape{plural} • {meters}m au total',
    'visitor.nav.noRoute': 'Aucune instruction disponible. Demandez à l\'accueil.',
    'visitor.nav.recenter': 'Recentrer la carte',
    'visitor.nav.focusRoute': 'Voir l\'itinéraire',
    'visitor.nav.askAssistant': 'Assistant',
    'visitor.nav.alerts': 'Alertes & infos',
    'visitor.nav.simStart': 'Simuler la marche (démo)',
    'visitor.nav.simStop': 'Arrêter la simulation',
    'visitor.nav.followSignage': 'Suivez la signalisation',
    'visitor.nav.scrollTop': 'Haut de la page',
    'visitor.nav.loading': 'Chargement de votre itinéraire...',
    'visitor.nav.arrived.title': 'Vous êtes arrivé',
    'visitor.nav.arrived.message': 'Vous avez atteint {destination}.',
    'visitor.nav.arrived.spoken': 'Vous êtes arrivé à destination.',
    'visitor.nav.alerts.your': 'Votre visite en cours',
    'visitor.nav.alerts.onSite': 'Sur place',
    'visitor.nav.alerts.remaining': 'reste {meters}m • ~{minutes} min',
    'visitor.nav.alerts.emergency': 'Urgence',
    'visitor.nav.alerts.emergencyText': 'En cas de problème, contactez l\'accueil immédiatement.',
    'visitor.nav.alerts.callReception': 'Appeler l\'accueil',

    'visitor.layout.online': 'En ligne',
    'visitor.layout.navigating': 'Navigation',

    'admin.users.assignedLocation': 'Lieu attribué',
    'admin.users.selectLocation': 'Sélectionnez un lieu...',
  },

  rw: {
    'lang.label': 'RW',
    'lang.english': 'English',
    'lang.french': 'Français',
    'lang.kinyarwanda': 'Kinyarwanda',

    'visitor.checkin.title': 'Ikaze muri {org}',
    'visitor.checkin.subtitle': 'Iyandikishe mbere yo kwinjira.',
    'visitor.checkin.location': 'Aho uri',
    'visitor.checkin.fullName': 'Amazina yose',
    'visitor.checkin.idOrPhone': 'Indangamuntu cyangwa Telefoni',
    'visitor.checkin.dest': 'Ugiye he?',
    'visitor.checkin.destPlaceholder': 'Urugero: Ibiro by\'imari, HR',
    'visitor.checkin.selectDest': 'Hitamo aho ugiye...',
    'visitor.checkin.other': 'Ikindi (andika)',
    'visitor.checkin.start': 'Tangira kwerekezwa',
    'visitor.checkin.analyzing': 'Turimo gusesengura aho ujya...',
    'visitor.checkin.loading': 'Sisitemu iracyatangira. Ongera ugerageze.',
    'visitor.checkin.notFound': 'Ntitwabashije kubona aho ugiye. Sobanura ukundi.',
    'visitor.checkin.unable': 'Ntitubashije gutangira kwerekezwa ubu.',
    'visitor.checkin.qrLoading': 'Turimo gutegura kwiyandikisha kwa QR...',
    'visitor.checkin.qrFailed': 'Ntitwabashije gutangira kwiyandikisha kwa QR. Ongera ugerageze.',

    'visitor.nav.routeInstructions': 'Amabwiriza y\'inzira',
    'visitor.nav.endVisit': 'Soza uruzinduko',
    'visitor.nav.progress': 'Aho ugeze',
    'visitor.nav.eta': 'Igihe gisigaye',
    'visitor.nav.min': 'min.',
    'visitor.nav.destination': 'Aho ugiye',
    'visitor.nav.visitor': 'Umushyitsi',
    'visitor.nav.youAreHere': 'Uri hano',
    'visitor.nav.metersAway': 'hasigaye m{meters}',
    'visitor.nav.metersOf': 'm{done} kuri m{total}',
    'visitor.nav.totalSteps': 'Intambwe {steps} • Hose m{meters}',
    'visitor.nav.noRoute': 'Nta nzira ihari. Baza ku biro by\'akira abashyitsi.',
    'visitor.nav.recenter': 'Subiza ikarita hagati',
    'visitor.nav.focusRoute': 'Reba inzira',
    'visitor.nav.askAssistant': 'Baza umufasha',
    'visitor.nav.alerts': 'Imenyesha n\'amakuru',
    'visitor.nav.simStart': 'Igana ko ugenda (demo)',
    'visitor.nav.simStop': 'Hagarika igana',
    'visitor.nav.followSignage': 'Kurikiza ibimenyetso',
    'visitor.nav.scrollTop': 'Garuka hejuru',
    'visitor.nav.loading': 'Turimo gutegura inzira yawe...',
    'visitor.nav.arrived.title': 'Wagereye',
    'visitor.nav.arrived.message': 'Wagereye kuri {destination}.',
    'visitor.nav.arrived.spoken': 'Wagereye aho wagiye.',
    'visitor.nav.alerts.your': 'Uruzinduko rwawe',
    'visitor.nav.alerts.onSite': 'Aho uri',
    'visitor.nav.alerts.remaining': 'hasigaye m{meters} • ~{minutes} min.',
    'visitor.nav.alerts.emergency': 'Ihutirwa',
    'visitor.nav.alerts.emergencyText': 'Niba utameze neza, hamagara ibiro by\'akira abashyitsi.',
    'visitor.nav.alerts.callReception': 'Hamagara ibiro',

    'visitor.layout.online': 'Kuri murandasi',
    'visitor.layout.navigating': 'Kuyobora',

    'admin.users.assignedLocation': 'Aho akorera',
    'admin.users.selectLocation': 'Hitamo aho akorera...',
  },
};

const LanguageContext = createContext(null);

function loadInitialLanguage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    // ignore
  }
  return 'en';
}

function format(template, vars) {
  if (!template) return '';
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadInitialLanguage);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* ignore */ }
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (SUPPORTED.includes(next)) setLanguageState(next);
  }, []);

  const cycleLanguage = useCallback(() => {
    setLanguageState((current) => {
      const idx = SUPPORTED.indexOf(current);
      return SUPPORTED[(idx + 1) % SUPPORTED.length];
    });
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTIONARY[language] || DICTIONARY.en;
      const fallback = DICTIONARY.en[key];
      return format(dict[key] || fallback || key, vars);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      languages: SUPPORTED,
      setLanguage,
      cycleLanguage,
      t,
      label: DICTIONARY[language]?.['lang.label'] || 'EN',
    }),
    [language, setLanguage, cycleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
