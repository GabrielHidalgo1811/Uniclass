import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  loading = false,
  itemName = ''
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl dark:bg-slate-900">
        <div className="bg-red-500/10 p-6 flex justify-center">
          <div className="bg-red-500/20 p-3 rounded-full">
            <Trash2 className="h-10 w-10 text-red-500" />
          </div>
        </div>
        
        <div className="p-6 pt-2 text-center">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white text-center">
              {title || '¿Estás seguro?'}
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-slate-400 text-center text-sm leading-relaxed">
              {description || `Estás a punto de eliminar "${itemName}". Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose} 
              className="flex-1 rounded-xl h-11 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={onConfirm} 
              className="flex-1 rounded-xl h-11 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Eliminando...</span>
                </div>
              ) : 'Confirmar Eliminación'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmationModal;
