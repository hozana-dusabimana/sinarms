/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import {
  buildPseudoQrSvg,
  downloadCsv,
  downloadTextFile,
  formatDateTime,
  getLocationById,
  getLocationMap,
  getNode,
  getOrganizationById,
  minutesBetween,
} from '../lib/sinarmsEngine';

const ACTIVE_VISITOR_KEY = 'sinarms-active-visitor-v3';

const ADMIN_PERMISSIONS = {
  viewLiveMap: true,
  manualRegister: true,
  manualCheckout: true,
  viewAlerts: true,
  notifyDepartment: true,
  analytics: true,
  exportData: true,
  manageFaq: true,
  manageUsers: true,
  manageOrganizations: true,
  manageLocations: true,
  editMap: true,
  viewAuditLog: true,
};

const EMPTY_STATE = {
  organizations: [],
  locations: [],
  users: [],
  visitors: [],
  alerts: [],
  faq: [],
  auditLog: [],
  notifications: [],
  maps: {},
};

const EMPTY_ANALYTICS = {
  totalVisitors: 0,
  activeVisitors: 0,
  averageDuration: 0,
  alertsToday: 0,
  arrivalsByDay: [],
  topDestinations: [],
  peakHours: [],
};

const SinarmsContext = createContext(null);

function loadActiveVisitorId() {
  try {
    return window.localStorage.getItem(ACTIVE_VISITOR_KEY);
  } catch {
    return null;
  }
}

function normalizeState(snapshot) {
  return {
    ...EMPTY_STATE,
    ...(snapshot || {}),
    maps: snapshot?.maps || {},
    organizations: snapshot?.organizations || [],
    locations: snapshot?.locations || [],
    users: snapshot?.users || [],
    visitors: snapshot?.visitors || [],
    alerts: snapshot?.alerts || [],
    faq: snapshot?.faq || [],
    auditLog: snapshot?.auditLog || [],
    notifications: snapshot?.notifications || [],
  };
}

function normalizeAnalytics(snapshot) {
  return {
    ...EMPTY_ANALYTICS,
    ...(snapshot || {}),
    arrivalsByDay: snapshot?.arrivalsByDay || [],
    topDestinations: snapshot?.topDestinations || [],
    peakHours: snapshot?.peakHours || [],
  };
}

function upsertById(list, item) {
  const remaining = list.filter((entry) => entry.id !== item.id);
  return [item, ...remaining];
}

function replaceAlert(list, item) {
  return list.map((entry) => (entry.id === item.id ? item : entry));
}

function downloadDataUrl(filename, dataUrl) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

async function request(url, config) {
  const response = await api(url, config);
  return response.data;
}

export function SinarmsProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [session, setSession] = useState(null);
  const [activeVisitorId, setActiveVisitorId] = useState(loadActiveVisitorId);
  const [authResolved, setAuthResolved] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (activeVisitorId) {
      window.localStorage.setItem(ACTIVE_VISITOR_KEY, activeVisitorId);
      return;
    }

    window.localStorage.removeItem(ACTIVE_VISITOR_KEY);
  }, [activeVisitorId]);

  const loadPublicBootstrap = useCallback(async () => {
    const data = await request('/api/bootstrap/public');
    setState((current) => {
      const next = normalizeState(data.state);
      const preservedVisitor = activeVisitorId
        ? current.visitors.find((visitor) => visitor.id === activeVisitorId)
        : null;

      if (preservedVisitor && !next.visitors.find((visitor) => visitor.id === preservedVisitor.id)) {
        next.visitors = upsertById(next.visitors, preservedVisitor);
      }

      return next;
    });
    setAnalytics(normalizeAnalytics(data.analytics));
    return data;
  }, [activeVisitorId]);

  const loadStaffBootstrap = useCallback(async () => {
    const data = await request('/api/bootstrap/staff');
    setSession({ user: data.user });
    setState(normalizeState(data.state));
    setAnalytics(normalizeAnalytics(data.analytics));
    return data;
  }, []);

  const refreshCurrentVisitor = useCallback(async (visitorId = activeVisitorId) => {
    if (!visitorId) {
      return null;
    }

    try {
      const visitor = await request(`/api/visitors/${visitorId}`);
      setState((current) => ({
        ...current,
        visitors: upsertById(current.visitors, visitor),
      }));
      return visitor;
    } catch (error) {
      if (error.response?.status === 404) {
        setActiveVisitorId(null);
      }
      return null;
    }
  }, [activeVisitorId]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await loadPublicBootstrap();
        try {
          await loadStaffBootstrap();
        } catch (error) {
          if (error.response?.status !== 401) {
            console.error('Unable to hydrate staff session', error);
          }
        }
        await refreshCurrentVisitor(loadActiveVisitorId());
      } catch (error) {
        console.error('Unable to initialize SINARMS frontend', error);
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
          setIsReady(true);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadPublicBootstrap, loadStaffBootstrap, refreshCurrentVisitor]);

  // Keep the staff dashboard in sync with self-check-ins / position updates
  // coming from other devices. The backend emits socket events but the
  // frontend does not (yet) subscribe to them, so a short poll is the
  // simplest reliable fallback.
  useEffect(() => {
    if (!session?.user) return undefined;
    const id = setInterval(() => {
      loadStaffBootstrap().catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [session?.user, loadStaffBootstrap]);

  const currentUser = session?.user || null;
  const currentVisitor = activeVisitorId
    ? state.visitors.find((visitor) => visitor.id === activeVisitorId) || null
    : null;
  const permissions = currentUser?.role === 'admin'
    ? ADMIN_PERMISSIONS
    : currentUser?.permissions || {};

  function hasPermission(permission) {
    if (!currentUser) {
      return false;
    }

    if (currentUser.role === 'admin') {
      return true;
    }

    return Boolean(permissions[permission]);
  }

  async function login({ email, password }) {
    try {
      const data = await request('/api/auth/login', {
        method: 'post',
        data: { email, password },
      });
      setSession({ user: data.user });
      await loadStaffBootstrap();
      return { ok: true, user: data.user };
    } catch (error) {
      return {
        ok: false,
        message: error.response?.data?.message || 'Unable to sign in.',
      };
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'post' });
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Logout failed', error);
      }
    }

    setSession(null);
    await loadPublicBootstrap();
  }

  async function classifyVisitorDestination({ locationId, destinationText, language = 'en' }) {
    try {
      return await request('/ai/classify-intent', {
        method: 'post',
        data: {
          locationId,
          text: destinationText,
          language,
        },
      });
    } catch (error) {
      return {
        status: 'retry',
        confidence: 0,
        destinationNodeId: null,
        alternatives: [],
        message: error.response?.data?.message || 'Unable to classify the destination right now.',
      };
    }
  }

  async function registerVisitor({
    name,
    idOrPhone,
    destinationText,
    language,
    organizationId,
    locationId,
    source = 'self',
    hostName,
    destinationNodeId,
  }) {
    const endpoint = source === 'manual' ? '/api/visitors/manual-register' : '/api/visitors/checkin';
    const data = await request(endpoint, {
      method: 'post',
      data: {
        name,
        idOrPhone,
        idNumber: idOrPhone,
        phone: idOrPhone,
        destinationText,
        language,
        organizationId,
        locationId,
        hostName,
        destinationNodeId,
      },
    });

    if (!data.visitor) {
      throw new Error(data.classification?.message || 'Unable to register visitor.');
    }

    setState((current) => ({
      ...current,
      visitors: upsertById(current.visitors, data.visitor),
    }));

    if (source === 'self') {
      setActiveVisitorId(data.visitor.id);
    }

    if (currentUser) {
      await loadStaffBootstrap();
    }

    return data.visitor;
  }

  async function setCurrentVisitor(visitorId) {
    setActiveVisitorId(visitorId);
    return refreshCurrentVisitor(visitorId);
  }

  async function moveVisitor(visitorId, nodeId = null, source = 'wifi') {
    const visitor = await request(`/api/visitors/${visitorId}/position`, {
      method: 'post',
      data: { nodeId, source },
    });

    setState((current) => ({
      ...current,
      visitors: upsertById(current.visitors, visitor),
    }));

    if (currentUser) {
      await loadStaffBootstrap();
    }

    return visitor;
  }

  async function sendHeartbeat(visitorId) {
    return moveVisitor(visitorId, null, 'wifi');
  }

  async function rerouteVisitor(visitorId, { destinationNodeId, locationId } = {}) {
    if (!visitorId || !destinationNodeId) return null;
    const visitor = await request(`/api/visitors/${visitorId}/reroute`, {
      method: 'post',
      data: { destinationNodeId, locationId },
    });

    setState((current) => ({
      ...current,
      visitors: upsertById(current.visitors, visitor),
    }));

    if (currentUser) {
      await loadStaffBootstrap();
    }

    return visitor;
  }

  async function notifyDepartment(visitorId) {
    const visitor = await request(`/api/visitors/${visitorId}/notify-dept`, {
      method: 'post',
    });

    setState((current) => ({
      ...current,
      visitors: upsertById(current.visitors, visitor),
    }));

    if (currentUser) {
      await loadStaffBootstrap();
    }

    return visitor;
  }

  async function checkoutVisitor(visitorId, { manual = false, survey = null } = {}) {
    const visitor = manual && currentUser
      ? await request(`/api/visitors/${visitorId}/checkout-manual`, { method: 'post' })
      : await request('/api/visitors/checkout', {
          method: 'post',
          data: { id: visitorId, survey },
        });

    setState((current) => ({
      ...current,
      visitors: upsertById(current.visitors, visitor),
    }));

    if (activeVisitorId === visitorId) {
      setActiveVisitorId(null);
    }

    if (currentUser) {
      await loadStaffBootstrap();
    } else {
      await loadPublicBootstrap();
    }

    return visitor;
  }

  async function acknowledgeAlert(alertId) {
    const alert = await request(`/api/alerts/${alertId}/acknowledge`, {
      method: 'post',
    });

    setState((current) => ({
      ...current,
      alerts: replaceAlert(current.alerts, alert),
    }));

    await loadStaffBootstrap();
    return alert;
  }

  async function deactivateAlert(alertId) {
    const alert = await request(`/api/alerts/${alertId}/resolve`, {
      method: 'post',
    });

    setState((current) => ({
      ...current,
      alerts: replaceAlert(current.alerts, alert),
    }));

    await loadStaffBootstrap();
    return alert;
  }

  async function createOrganization(payload) {
    const organization = await request('/api/organizations', {
      method: 'post',
      data: payload,
    });
    await loadStaffBootstrap();
    return organization;
  }

  async function updateOrganization(organizationId, payload) {
    const organization = await request(`/api/organizations/${organizationId}`, {
      method: 'put',
      data: payload,
    });
    await loadStaffBootstrap();
    return organization;
  }

  async function deactivateOrganization(organizationId) {
    const organization = await request(`/api/organizations/${organizationId}`, {
      method: 'delete',
    });
    await loadStaffBootstrap();
    return organization;
  }

  async function createLocation(organizationId, payload) {
    const location = await request(`/api/organizations/${organizationId}/locations`, {
      method: 'post',
      data: payload,
    });
    await loadStaffBootstrap();
    return location;
  }

  async function updateLocation(locationId, payload) {
    const location = await request(`/api/locations/${locationId}`, {
      method: 'put',
      data: payload,
    });
    await loadStaffBootstrap();
    return location;
  }

  async function deactivateLocation(locationId) {
    const location = await request(`/api/locations/${locationId}`, {
      method: 'delete',
    });
    await loadStaffBootstrap();
    return location;
  }

  async function assignReceptionist(userId, locationId) {
    const location = getLocationById(state, locationId);
    if (!location) {
      throw new Error('Location not found.');
    }

    const user = await request(`/api/users/${userId}`, {
      method: 'put',
      data: {
        locationId,
        organizationId: location.organizationId,
      },
    });
    await loadStaffBootstrap();
    return user;
  }

  async function createUser(payload) {
    const user = await request('/api/users', {
      method: 'post',
      data: payload,
    });
    await loadStaffBootstrap();
    return user;
  }

  async function updateUser(userId, payload) {
    const user = await request(`/api/users/${userId}`, {
      method: 'put',
      data: payload,
    });
    await loadStaffBootstrap();
    return user;
  }

  async function updateOwnProfile(payload) {
    const user = await request('/api/users/me', {
      method: 'put',
      data: payload,
    });
    await loadStaffBootstrap();
    return user;
  }

  async function updateUserPermissions(userId, nextPermissions) {
    const user = await request(`/api/users/${userId}/permissions`, {
      method: 'put',
      data: nextPermissions,
    });
    await loadStaffBootstrap();
    return user;
  }

  async function deactivateUser(userId) {
    const user = await request(`/api/users/${userId}`, {
      method: 'delete',
    });
    await loadStaffBootstrap();
    return user;
  }

  async function createFaq(payload) {
    const faqEntry = await request('/api/faq', {
      method: 'post',
      data: payload,
    });
    await loadStaffBootstrap();
    return faqEntry;
  }

  async function updateFaq(faqId, payload) {
    const faqEntry = await request(`/api/faq/${faqId}`, {
      method: 'put',
      data: payload,
    });
    await loadStaffBootstrap();
    return faqEntry;
  }

  async function deleteFaq(faqId) {
    const result = await request(`/api/faq/${faqId}`, {
      method: 'delete',
    });
    await loadStaffBootstrap();
    return result;
  }

  async function updateLocationMap(locationId, nextMap) {
    const savedMap = await request(`/api/locations/${locationId}/map`, {
      method: 'put',
      data: nextMap,
    });

    setState((current) => ({
      ...current,
      maps: {
        ...current.maps,
        [locationId]: savedMap,
      },
    }));

    if (currentUser) {
      await loadStaffBootstrap();
    }

    return savedMap;
  }

  function setLocationFloorplan(locationId, floorplanImage) {
    setState((current) => ({
      ...current,
      maps: {
        ...current.maps,
        [locationId]: {
          ...getLocationMap(current, locationId),
          floorplanImage,
        },
      },
    }));
  }

  async function downloadLocationQr(locationId) {
    const location = getLocationById(state, locationId);
    if (!location) {
      return;
    }

    const response = await api.get(`/api/locations/${locationId}/qr-code`, {
      responseType: 'text',
    });

    downloadTextFile(
      `${location.name.replace(/\s+/g, '-').toLowerCase()}-qr.svg`,
      response.data,
      'image/svg+xml;charset=utf-8',
    );
  }

  function downloadVisitorPass(visitorId) {
    const visitor = state.visitors.find((entry) => entry.id === visitorId);
    if (!visitor) {
      return;
    }

    const svg = buildPseudoQrSvg(`${visitor.name} | ${visitor.id}`);
    downloadTextFile(
      `${visitor.name.replace(/\s+/g, '-').toLowerCase()}-pass.svg`,
      svg,
      'image/svg+xml;charset=utf-8',
    );
  }

  function downloadFloorplan(locationId) {
    const map = getLocationMap(state, locationId);
    const location = getLocationById(state, locationId);
    if (!map.floorplanImage || !location) {
      return;
    }

    downloadDataUrl(
      `${location.name.replace(/\s+/g, '-').toLowerCase()}-floorplan.png`,
      map.floorplanImage,
    );
  }

  function exportVisitors(filters = {}) {
    const rows = state.visitors
      .filter((visitor) => {
        if (filters.organizationId && visitor.organizationId !== filters.organizationId) {
          return false;
        }

        if (filters.locationId && visitor.locationId !== filters.locationId) {
          return false;
        }

        return true;
      })
      .map((visitor) => ({
        Name: visitor.name,
        Location: getLocationById(state, visitor.locationId)?.name || visitor.locationId,
        Organization: getOrganizationById(state, visitor.organizationId)?.name || visitor.organizationId,
        CheckIn: formatDateTime(visitor.checkinTime),
        CheckOut: visitor.checkoutTime ? formatDateTime(visitor.checkoutTime) : '',
        Status: visitor.status,
        Destination: getNode(getLocationMap(state, visitor.locationId), visitor.destinationNodeId)?.label || visitor.destinationText,
        DurationMin: visitor.durationMin || '',
      }));

    downloadCsv('visitors.csv', rows);
  }

  function exportAudit() {
    const rows = state.auditLog.map((entry) => ({
      Timestamp: formatDateTime(entry.timestamp),
      Actor: entry.actorName,
      Action: entry.actionType,
      TargetType: entry.targetType,
      TargetId: entry.targetId,
      Details: entry.details,
      IP: entry.ipAddress,
    }));

    downloadCsv('audit-log.csv', rows);
  }

  function exportAnalytics(filters = {}) {
    const scopedVisitors = state.visitors.filter((visitor) => {
      if (filters.organizationId && visitor.organizationId !== filters.organizationId) {
        return false;
      }

      if (filters.locationId && visitor.locationId !== filters.locationId) {
        return false;
      }

      return true;
    });

    const rows = scopedVisitors.map((visitor) => ({
      Name: visitor.name,
      Status: visitor.status,
      Location: getLocationById(state, visitor.locationId)?.name || visitor.locationId,
      Destination: getNode(getLocationMap(state, visitor.locationId), visitor.destinationNodeId)?.label || visitor.destinationText,
      DurationMin: visitor.durationMin || minutesBetween(visitor.checkinTime),
    }));

    downloadCsv('analytics.csv', rows);
  }

  async function sendChatbotQuery(payload) {
    const data = await request('/api/chatbot/query', {
      method: 'post',
      data: payload,
    });

    const resolvedLocationId = data.locationId || payload.locationId;
    const targetMap = getLocationMap(state, resolvedLocationId);
    const suggestedNodeId = data.destinationNodeId || data.alternatives?.[0]?.nodeId || null;
    const suggestedNode = suggestedNodeId ? getNode(targetMap, suggestedNodeId) : null;

    const navExtras = {
      destinationNodeId: suggestedNodeId,
      destinationLabel: suggestedNode?.label || null,
      locationId: resolvedLocationId,
      locationName: data.locationName || null,
      crossLocation: Boolean(data.crossLocation) && resolvedLocationId !== payload.locationId,
      status: data.status || null,
      alternatives: data.alternatives || [],
    };

    if (data.answer) {
      return { ...data, ...navExtras };
    }

    if (data.fallback) {
      return {
        answer: data.fallback,
        confidence: data.confidence || 0,
        type: 'faq',
      };
    }

    if (data.status === 'confirm' && data.alternatives?.length) {
      return {
        answer: `Did you mean ${data.alternatives.map((option) => option.label).join(' or ')}?`,
        confidence: data.confidence || 0,
        type: 'navigation',
        ...navExtras,
      };
    }

    return {
      answer: suggestedNode
        ? `Head toward ${suggestedNode.label}. Follow the highlighted route on the map.`
        : 'I am not sure about that. Please ask at the Reception desk.',
      confidence: data.confidence || 0,
      type: 'navigation',
      ...navExtras,
    };
  }

  async function fetchVisitorHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.organizationId) query.set('organizationId', params.organizationId);
    if (params.locationId) query.set('locationId', params.locationId);
    const qs = query.toString();
    const visitors = await request(`/api/visitors/history${qs ? `?${qs}` : ''}`);
    return Array.isArray(visitors) ? visitors : [];
  }

  const value = {
    state,
    analytics,
    session,
    currentUser,
    currentVisitor,
    permissions,
    authResolved,
    isReady,
    activeAlerts: state.alerts.filter((alert) => !alert.resolvedAt),
    scopedVisitors: state.visitors,
    hasPermission,
    login,
    logout,
    classifyVisitorDestination,
    registerVisitor,
    setCurrentVisitor,
    moveVisitor,
    rerouteVisitor,
    sendHeartbeat,
    notifyDepartment,
    checkoutVisitor,
    acknowledgeAlert,
    deactivateAlert,
    createOrganization,
    updateOrganization,
    deactivateOrganization,
    createLocation,
    updateLocation,
    deactivateLocation,
    assignReceptionist,
    createUser,
    updateUser,
    updateOwnProfile,
    updateUserPermissions,
    deactivateUser,
    createFaq,
    updateFaq,
    deleteFaq,
    updateLocationMap,
    setLocationFloorplan,
    downloadLocationQr,
    downloadVisitorPass,
    downloadFloorplan,
    exportVisitors,
    exportAudit,
    exportAnalytics,
    sendChatbotQuery,
    fetchVisitorHistory,
  };

  return <SinarmsContext.Provider value={value}>{children}</SinarmsContext.Provider>;
}

export function useSinarms() {
  const context = useContext(SinarmsContext);
  if (!context) {
    throw new Error('useSinarms must be used within SinarmsProvider');
  }

  return context;
}
