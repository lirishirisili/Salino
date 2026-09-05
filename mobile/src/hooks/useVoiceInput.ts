import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useTranslation } from 'react-i18next';
import { parseVoiceInput } from '../services/voiceInputParser';
import type { ParsedVoiceItem } from '../models';

interface UseVoiceInputOptions {
  onResult: (parsed: ParsedVoiceItem) => void;
}

/**
 * Recognition events are emitted globally, and several screens keep this hook
 * mounted at once (shopping-list stays in the stack under add-item). Each start
 * claims the newest id so only the screen that began dictation reacts to it.
 */
let activeSessionId = 0;

export function useVoiceInput({ onResult }: UseVoiceInputOptions) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const lastTranscriptRef = useRef('');
  const sessionIdRef = useRef(0);

  const ownsSession = () =>
    sessionIdRef.current !== 0 && sessionIdRef.current === activeSessionId;

  const releaseSession = () => {
    sessionIdRef.current = 0;
    setIsListening(false);
  };

  useSpeechRecognitionEvent('result', (event) => {
    if (!ownsSession()) return;

    const transcript = event.results?.[0]?.transcript;
    if (!transcript || transcript === lastTranscriptRef.current) return;

    lastTranscriptRef.current = transcript;
    onResult(parseVoiceInput(transcript));

    if (event.isFinal) setIsListening(false);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!ownsSession()) return;
    releaseSession();
  });

  useSpeechRecognitionEvent('error', () => {
    if (!ownsSession()) return;
    releaseSession();
  });

  // Leaving the screen mid-dictation must not keep the recognizer running.
  useEffect(() => {
    return () => {
      if (!ownsSession()) return;
      sessionIdRef.current = 0;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('', t('voice_input_permission_denied'));
        return;
      }

      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        Alert.alert('', t('voice_input_unavailable'));
        return;
      }

      lastTranscriptRef.current = '';
      sessionIdRef.current = ++activeSessionId;
      setIsListening(true);

      const lang = i18n.language || 'en';
      const locale = Platform.OS === 'android' ? lang.replace('-', '_') : lang;

      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch {
      releaseSession();
      Alert.alert('', t('voice_input_unavailable'));
    }
  }, [t, i18n.language]);

  const stopListening = useCallback(() => {
    try {
      // Keep the session claimed so the final result still lands in this field.
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening };
}
