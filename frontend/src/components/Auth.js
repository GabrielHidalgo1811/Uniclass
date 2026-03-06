import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación de contraseña
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await signIn(email, password);
        if (error) {
          console.error('Login error:', error);
          // Mensaje más amigable
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email o contraseña incorrectos. Verifica tus credenciales.');
          } else if (error.message.includes('body stream')) {
            toast.error('Email o contraseña incorrectos. Por favor intenta de nuevo.');
          } else {
            toast.error(error.message || 'Error al iniciar sesión');
          }
          return;
        }
        if (data?.user) {
          toast.success('¡Bienvenido de nuevo!');
        }
      } else {
        const { data, error } = await signUp(email, password);
        if (error) {
          console.error('Signup error:', error);
          if (error.message.includes('already registered')) {
            toast.error('Este email ya está registrado. Intenta iniciar sesión.');
          } else {
            toast.error(error.message || 'Error al crear cuenta');
          }
          return;
        }
        if (data?.user) {
          toast.success('Cuenta creada exitosamente');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Error de autenticación. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e8f4f1 0%, #e4e0f1 100%)' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/uniclass-logo-login.png" alt="Uniclass" className="h-24 object-contain" />
          </div>
          <CardDescription className="text-base">
            {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta nueva'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="auth-submit-button"
            >
              {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-blue-600 hover:underline"
              data-testid="toggle-auth-mode"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
