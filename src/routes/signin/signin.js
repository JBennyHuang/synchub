import { Card } from 'antd';
import React from 'react';
import { StyledFirebaseAuth } from 'react-firebaseui';
import app from '../../firebase/firebase';
import firebase from 'firebase';

const uiConfig = {
  signInFlow: 'redirect',
  signInSuccessUrl: '/',
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.FacebookAuthProvider.PROVIDER_ID,
  ],
};

const Signin = ({ authContext }) => {
  return (
    <>
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }} >
        <Card>
          <div style={{ margin: "20px" }}>
            <StyledFirebaseAuth uiConfig={uiConfig} firebaseAuth={app.auth()} ></StyledFirebaseAuth>
          </div>
        </Card>
      </div>
    </>
  )
}

export default Signin