import { useState, useCallback } from 'react';

interface EmailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface EmailState {
  loading: boolean;
  success: boolean;
  error: string | null;
  messageId?: string;
}

/**
 * Hook para enviar emails optimizado
 * El servidor mantiene la conexión SMTP abierta
 */
export const useEmailService = () => {
  const [state, setState] = useState<EmailState>({
    loading: false,
    success: false,
    error: null,
  });

  const sendEmail = useCallback(async (payload: EmailPayload): Promise<boolean> => {
    setState({ loading: true, success: false, error: null });

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setState({
          loading: false,
          success: true,
          error: null,
          messageId: data.messageId,
        });
        return true;
      } else {
        throw new Error(data.error || 'Error desconocido al enviar email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al enviar email';
      setState({
        loading: false,
        success: false,
        error: errorMessage,
      });
      console.error('Error sending email:', error);
      return false;
    }
  }, []);

  return { ...state, sendEmail };
};