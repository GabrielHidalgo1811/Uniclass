// src/lib/googleCalendar.js

const getProviderToken = () => {
  return localStorage.getItem('google_provider_token');
};

const refreshGoogleToken = async () => {
  const refreshToken = localStorage.getItem('google_refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('google_provider_token', data.access_token);
      return data.access_token;
    }
    return null;
  } catch (err) {
    return null;
  }
};

export const createGoogleCalendarEvent = async (eventDetails) => {
  const token = getProviderToken();
  if (!token) throw new Error('No Google Auth Token found');

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventDetails)
  });

  if (!response.ok) {
    throw new Error('Failed to create event in Google Calendar: ' + await response.text());
  }

  const data = await response.json();
  return data.id; // google_event_id
};

export const updateGoogleCalendarEvent = async (googleEventId, eventDetails) => {
  const token = getProviderToken();
  if (!token) throw new Error('No Google Auth Token found');

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventDetails)
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Event doesn't exist anymore in Google, recreate it
      return await createGoogleCalendarEvent(eventDetails);
    }
    throw new Error('Failed to update event in Google Calendar: ' + await response.text());
  }

  return googleEventId;
};

export const deleteGoogleCalendarEvent = async (googleEventId) => {
  const token = getProviderToken();
  if (!token) return;

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    console.warn('Failed to delete event in Google Calendar: ' + await response.text());
  }
};

export const fetchRecentGoogleEvents = async (timeMin = new Date().toISOString(), isRetry = false) => {
  let token = getProviderToken();
  if (!token) {
    if (isRetry) return [];
    token = await refreshGoogleToken();
    if (!token) return [];
  }

  try {
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!listRes.ok) {
      if ((listRes.status === 401 || listRes.status === 403) && !isRetry) {
        throw new Error("Token de Google expirado");
      }
      throw new Error("Failed to fetch calendar list");
    }
    const listData = await listRes.json();
    const calendars = listData.items || [];

    const activeCalendars = calendars.filter(c => c.selected || c.primary);

    const eventPromises = activeCalendars.map(async (calendar) => {
      try {
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=1000&singleEvents=true`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return (data.items || []).map(ev => ({
           ...ev,
           calendarColor: calendar.backgroundColor || '#3b82f6'
        }));
      } catch (err) {
        return [];
      }
    });

    const results = await Promise.all(eventPromises);
    return results.flat();
  } catch (err) {
    console.error('Failed to fetch events from Google Calendars', err);
    if (err.message === "Token de Google expirado") {
      const newToken = await refreshGoogleToken();
      if (newToken) {
        return fetchRecentGoogleEvents(timeMin, true); // Retry magically and silently once
      } else if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        if (toast) toast.error('Sesión de Google expirada fuertemente. Por favor cierra sesión en Uniclass y vuelve a iniciar sesión con Google.');
      }
    }
    return [];
  }
};
