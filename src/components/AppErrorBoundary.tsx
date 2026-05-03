import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Branded error boundary with restart and report actions.
 * Uses inline styles (not NativeWind) since NativeWind may be unavailable
 * if the error occurred during its initialization.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRestart = async () => {
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {
      // In dev or if Updates unavailable, just reset state
      this.setState({ hasError: false, error: null });
    }
  };

  handleReport = () => {
    const errorMsg = this.state.error?.message ?? t('errorBoundary.unknownError');
    const stack = this.state.error?.stack?.slice(0, 500) ?? '';
    const body = encodeURIComponent(
      `Error: ${errorMsg}\n\nStack:\n${stack}`,
    );
    const subject = encodeURIComponent(t('errorBoundary.bugReportSubject'));
    Linking.openURL(
      `mailto:arctos.built@gmail.com?subject=${subject}&body=${body}`,
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.title}>{t('errorBoundary.title')}</Text>
            <Text style={styles.subtitle}>
              {t('errorBoundary.subtitle')}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleRestart}
              accessibilityLabel={t('errorBoundary.restartA11y')}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{t('errorBoundary.restart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.handleReport}
              accessibilityLabel={t('errorBoundary.reportIssueA11y')}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>{t('errorBoundary.reportIssue')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F4F1',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1B18',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#706C67',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#4272C4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#4272C4',
    fontSize: 14,
    fontWeight: '500',
  },
});
