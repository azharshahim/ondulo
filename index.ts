// Point d'entrée : gesture-handler doit être importé avant tout le reste.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent garantit un démarrage identique sur Expo Go et en build natif.
registerRootComponent(App);
