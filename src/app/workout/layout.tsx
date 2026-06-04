import { Metadata, Viewport } from 'next';
import { WorkoutUserProvider } from '@/context/WorkoutUserContext';
import { WorkoutLanguageProvider } from '@/context/WorkoutLanguageContext';
import { WorkoutUnitProvider } from '@/context/WorkoutUnitContext';
import { WorkoutTimerProvider } from '@/context/WorkoutTimerContext';
import { WorkoutCustomExercisesProvider } from '@/context/WorkoutCustomExercisesContext';
import WorkoutShell from '@/components/workout/WorkoutShell';
import PwaInstaller from '@/components/workout/PwaInstaller';
import './workout.css';

export const metadata: Metadata = {
  title: '🏋️ Workout',
  description: 'Personal workout tracking app',
  // PWA: only /workout/* declares itself installable. Other features
  // keep their existing apple-touch-icon "Add to Home Screen" path.
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#c9a84c',
};

export default function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // WorkoutUserProvider is now above WorkoutShell so that anything rendered
  // by the shell itself (e.g. the help FAB) can read the current user.
  return (
    <WorkoutLanguageProvider>
      <WorkoutUnitProvider>
        <WorkoutTimerProvider>
          <WorkoutUserProvider>
            <WorkoutCustomExercisesProvider>
              <WorkoutShell>
                {children}
              </WorkoutShell>
              {/* Service-worker registration + offline / sync indicator. */}
              <PwaInstaller />
            </WorkoutCustomExercisesProvider>
          </WorkoutUserProvider>
        </WorkoutTimerProvider>
      </WorkoutUnitProvider>
    </WorkoutLanguageProvider>
  );
}
