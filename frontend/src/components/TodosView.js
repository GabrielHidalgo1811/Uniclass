import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const TodosView = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id);
      setSubjects(subjectsData || []);

      const { data: todosData, error } = await supabase
        .from('study_checklists')
        .select('*, subjects(name, color)')
        .eq('user_id', user.id)
        .order('is_completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(todosData || []);
    } catch (error) {
      toast.error('Error al cargar temarios');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;

    try {
      const { error } = await supabase
        .from('study_checklists')
        .insert([{
          user_id: user.id,
          subject_id: null,
          topic: newTodo,
          is_completed: false
        }]);

      if (error) throw error;
      toast.success('Temario agregado');
      setNewTodo('');
      loadData();
    } catch (error) {
      toast.error('Error al agregar temario');
    }
  };

  const toggleTodo = async (todoId, isCompleted) => {
    try {
      const { error } = await supabase
        .from('study_checklists')
        .update({ is_completed: !isCompleted })
        .eq('id', todoId)
        .eq('user_id', user.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      toast.error('Error al actualizar temario');
    }
  };

  const deleteTodo = async (todoId) => {
    try {
      const { error } = await supabase
        .from('study_checklists')
        .delete()
        .eq('id', todoId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Temario eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar temario');
    }
  };

  const pendingTodos = todos.filter(t => !t.is_completed);
  const completedTodos = todos.filter(t => t.is_completed);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-lg text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Temarios</h1>

        {/* Add new todo */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex space-x-2">
              <Input
                placeholder="Agregar nuevo tema de estudio..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                data-testid="add-todo-input"
              />
              <Button onClick={addTodo} data-testid="add-todo-button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending todos */}
        {pendingTodos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Pendientes ({pendingTodos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingTodos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid="todo-item">
                  <div className="flex items-center space-x-3 flex-1">
                    <Checkbox
                      checked={todo.is_completed}
                      onCheckedChange={() => toggleTodo(todo.id, todo.is_completed)}
                      data-testid="todo-checkbox"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{todo.topic}</div>
                      {todo.subjects && (
                        <div className="flex items-center space-x-2 mt-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: todo.subjects.color }}
                          />
                          <span className="text-sm text-gray-600">{todo.subjects.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTodo(todo.id)} data-testid="delete-todo-button">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Completed todos */}
        {completedTodos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Completados ({completedTodos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {completedTodos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60" data-testid="todo-item">
                  <div className="flex items-center space-x-3 flex-1">
                    <Checkbox
                      checked={todo.is_completed}
                      onCheckedChange={() => toggleTodo(todo.id, todo.is_completed)}
                      data-testid="todo-checkbox"
                    />
                    <div className="flex-1">
                      <div className="line-through">{todo.topic}</div>
                      {todo.subjects && (
                        <div className="flex items-center space-x-2 mt-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: todo.subjects.color }}
                          />
                          <span className="text-sm text-gray-600">{todo.subjects.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTodo(todo.id)} data-testid="delete-todo-button">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {todos.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No tienes temarios registrados aún.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TodosView;
