import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Detectar si la URL tiene parámetros de respuesta de Supabase OAuth
    const isCallback = typeof window !== 'undefined' && 
                      (window.location.hash.includes('access_token') || 
                       window.location.search.includes('code=') ||
                       window.location.search.includes('error='));

    // Failsafe por si falla el intercambio del código en silencio
    if (isCallback) {
      const urlSearch = new URLSearchParams(window.location.search);
      const urlHash = new URLSearchParams(window.location.hash.substring(1));
      const errorDesc = urlSearch.get('error_description') || urlHash.get('error_description');
      
      if (errorDesc) {
        alert("Error de Supabase: " + decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
      }

      setTimeout(() => {
        if (mounted) setLoading(false);
      }, 4000);
    }

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error("Error obteniendo sesión:", error);
        if (mounted) {
          setUser(session?.user ?? null);
          // Si hay tokens en la URL, mantenemos loading=true para que React Router 
          // no nos redirija y rompa el flujo PKCE antes de que termine.
          if (!isCallback) setLoading(false);
        }
      } catch (err) {
        if (mounted && !isCallback) setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Evento de autenticación de Supabase:', event);
      if (mounted) {
        if (session?.provider_token) {
          localStorage.setItem('google_provider_token', session.provider_token);
        }
        if (session?.provider_refresh_token) {
          localStorage.setItem('google_refresh_token', session.provider_refresh_token);
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('google_provider_token');
          localStorage.removeItem('google_refresh_token');
          setLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          setUser(session?.user ?? null);
          if (!isCallback || session?.user) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { data, error };
    } catch (err) {
      console.error('SignUp error:', err);
      return { data: null, error: err };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } catch (err) {
      console.error('SignIn error:', err);
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      return { data, error };
    } catch (err) {
      console.error('Google SignIn error:', err);
      return { data: null, error: err };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
