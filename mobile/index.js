import { AppRegistry, Platform } from 'react-native'
import App from './src/App'
import { name as appName } from './app.json'
import { setupBackgroundHandler } from './src/services/notifications'

setupBackgroundHandler()

AppRegistry.registerComponent(appName, () => App)
