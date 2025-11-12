import * as React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Dashboard from './screens/dashboard';
import WelcomeAboard from './screens/DeviceRegistration/WelcomeAboard';
import SignIn from './screens/DeviceRegistration/SignIn';
import DeviceRegisterInfo from './screens/DeviceRegistration/DeviceRegisterInfo';
import AddRestaurantDetails from './screens/DeviceRegistration/AddRestaurantDetails';
import DeviceRegisterSuccess from './screens/DeviceRegistration/DeviceRegisterSuccess';


const RootStackNavigator = createStackNavigator();


const RootNavigator = () => {
  return (
    <RootStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
        cardOverlayEnabled: true,
        cardShadowEnabled: false,
        animationEnabled: false,
        cardStyleInterpolator: ({ current: { progress } }) => ({
          overlayStyle: {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
              extrapolate: 'clamp',
            }),
          },
        }),
      }}
      headerMode='none'
      // mode="modal"
      initialRouteName="dashboard">

      <RootStackNavigator.Screen
        name="dashboard"
        component={Dashboard}
      />

      <RootStackNavigator.Screen
        name={'welcomeAboard'}
        component={WelcomeAboard}
      />
      <RootStackNavigator.Screen 
        name={'signIn'} 
        component={SignIn} 
      />
      <RootStackNavigator.Screen
        name={'deviceRegisterInfo'}
        component={DeviceRegisterInfo}
      />
      <RootStackNavigator.Screen
        name={'addRestaurantDetails'}
        component={AddRestaurantDetails}
      />
      <RootStackNavigator.Screen
        name={'deviceRegisterSuccess'}
        component={DeviceRegisterSuccess}
      />
      
    </RootStackNavigator.Navigator>
  );
};

const Routes = (): JSX.Element => {  
  return (
    <React.Fragment>
        <NavigationContainer>
            <RootNavigator />
        </NavigationContainer>
    </React.Fragment>
  );
};

export default Routes;
